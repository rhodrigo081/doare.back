import admin from "../config/db.js";
const db = admin.firestore();
import { Timestamp } from "firebase-admin/firestore";
import {
  ValidationError,
  DatabaseError,
  ExternalError,
  NotFoundError,
} from "../utils/Errors.js";
import DonationModel from "../models/Donation.js";
import pixService from "./PixService.js";
import { PartnerService } from "./PartnerService.js";

/**
 * @class DonationSevice
 * @description Gerencia todas as operações relacionadas as doações, como: criação,
 * processamento de webhook e diversas consultas
 */
class DonationService {
  /**
   * Criação de uma nova doação e cobrança Pix
   *
   * @param {object} data - Dados fornecidos pelo doador
   * @param {string} data.donorCPF - CPF do doador
   * @param {string} data.donorName - Nome do doador
   * @param {number} data.amout - Valor da doação
   * @returns {object}  - Objeto com os detalhes da doação e os dados da cobrança Pix
   * @throws {ValidationError} - Se os dados de entrada forem inválidos ou incompletos
   * @throws {NotFoundError} - Se o cpf não estiver cadastrado
   * @throws {ExternalError} - Se houver falha na comunicação com o serviço Pix
   */
  static async createDonation(data) {
    const { donorCPF, amount } = data;

    // Validação dos campos obrigatórios
    if (!donorCPF || !amount) {
      throw new ValidationError("Todos os campos são obrigatórios!");
    }

    // Validação do valor da doação
    if (parseFloat(amount) <= 0) {
      throw new ValidationError("O valor da doação deve ser maior que 0.");
    }

    // Validação e limpeza do CPF
    const cleanedCPF = donorCPF.replace(/\D/g, "");
    if (cleanedCPF.length !== 11) {
      throw new ValidationError("CPF Inválido!");
    }

    // Busca o parceiro associado ao CPF
    const existsPartner = await PartnerService.findByExactCPF(cleanedCPF);
    if (!existsPartner) {
      throw new NotFoundError("CPF não cadastrado");
    }

    let donorName = existsPartner.name;
    let donorCIM = existsPartner.cim;

    // Criaçao da cobrança Pix
    try {
      const pixChargeDetails = await pixService.createImmediatePixCharge({
        amount,
        donorCPF: cleanedCPF,
        donorName,
      });

      /**
       * Detalhes da doação e da cobrança Pix.
       * A doação só é armazenada no banco de dados quando o webhook de pagamento é recebido
       */
      return {
        donorCPF,
        donorName,
        donorCIM,
        amount: parseFloat(amount),
        txId: pixChargeDetails.txId,
        locId: pixChargeDetails.locId,
        qrCode: pixChargeDetails.qrCode,
        copyPaste: pixChargeDetails.copyPaste,
        status: "AGUARDANDO_PAGAMENTO",
        createdAt: pixChargeDetails.createdAt,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      throw new ExternalError(`Falha ao gerar cobrança Pix: ${error}`);
    }
  }

  /**
   * Verificação do status do pagamento, atualiza o status da doação
   *
   * @param {object} rawWebhookPayload - Payload recebido do webhook Pix
   * @returns {Promise<DonationModel | null>} - Doação atualizada ou null se o pagamento não for confirmado
   * @throws {ValidationError} - Se o payload do webhook for inválido ou ausente do txId(ID da transação)
   * @throws {ExternalError} - Se houver falha ao obter detalhes da cobrança do serviço Pix
   * @throws {DatabaseError} - Se ocorrer um erro inesperado na interação com o banco de dados
   */
  async handlePixWebhook(rawWebhookPayload) {
    const txId = rawWebhookPayload.txid;

    // Validação do payload do webhook
    if (!txId) {
      throw new ValidationError(
        "Id de transação ausente no payload do webhook"
      );
    }

    /**
     *  Buscar doaçao existente no banco de dados
     *  Necessária para evitar criação de doação duplicada,
     * caso o webhook seja reenviado
     */
    let donation = await DonationService.findByTxId(txId);

    // Confirmação de status
    try {
      // Busca a cobrança pelo id de transação
      const efiChargeDetails = await pixService.getPixDetails(txId);

      const officialStatus = efiChargeDetails.status; // Status da cobrança no gateway
      const valorOriginal = efiChargeDetails.valor.original; // Valor da cobrança
      const devedorEfi = efiChargeDetails.devedor; // Dados do devedor

      // Verifica se o pagamento foi confirmado
      const isPaymentConfirmed = officialStatus === "CONCLUIDA";

      if (isPaymentConfirmed) {
        if (donation) {
          // Atualiza o status da doação se o pagamento foi confirmado
          if (donation.status !== "PAGA") {
            donation.status = "PAGA";
            await donation.save();
          }
        } else {
          /**
           * Se a doação não existe
           * Extrai os dados essenciais do doador
           * e do valor
           */
          const donorCPFFromEfi = devedorEfi?.cpf;
          const donorNameFromEfi = devedorEfi?.nome;
          const amountFromEfi = parseFloat(valorOriginal);

          // Valida os dados esseciais recebidos da EFI
          if (!donorCPFFromEfi || !donorNameFromEfi || !amountFromEfi) {
            throw new ValidationError(
              `Dados insuficientes ou inválidos da EFI para criar nova doação: ${JSON.stringify(
                devedorEfi
              )} - R$ ${valorOriginal}`
            );
          }

          const existsPartner = await PartnerService.findByExactCPF(
            donorCPFFromEfi
          );
          let donorCIM =
            existsPartner && existsPartner.cim ? existsPartner.cim : null;

          // Cria uma nova instância de doação com os dados completos e status PAGA
          const newDonation = new DonationModel({
            donorCPF: donorCPFFromEfi,
            donorName: donorNameFromEfi,
            donorCIM: donorCIM,
            amount: amountFromEfi,
            txId: efiChargeDetails.txid,
            locId: efiChargeDetails.loc?.id,
            qrCode: efiChargeDetails.location,
            copyPaste: efiChargeDetails.pixCopiaECola,
            status: "PAGA",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await newDonation.save(); // Salva a nova doação no banco de dados
          donation = newDonation;
        }
      } else if (donation) {
        /**
         * Se o pagamento nao foi confirmado e a doação não existe no banco de dados
         * Atualiza o status da doação para refletir o status oficial do gateway
         * */
        if (donation.status !== officialStatus) {
          donation.status = officialStatus;
          await donation.save();
        }
      } else {
        // Se o pagamento nao foi confirmado, não há doação para atualizar
        donation = null;
      }
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof DatabaseError
      ) {
        throw error;
      } else if (error.response) {
        throw new ExternalError(
          `Erro ao obter detalhes da cobrança Pix: ${error}`
        );
      }

      throw new DatabaseError(`Erro inesperado ao processar transação ${txId}`);
    }

    return donation;
  }

  /**
   * Busdca uma doação no banco de dados através do id ded transação Pix
   *
   * @param {string} txId - Id da transação Pix a se buscado
   * @returns {Promise<DonationModel | null>} - Uma doação se encontrada ou null se nenhuma doação for encontrada
   * @throws {DatabaseError} - Lançada se ocorrer um erro durante a interação com o banco de dados
   */
  static async findByTxId(txId) {
    try {
      const snapshot = await db
        .collection("donations")
        .where("txId", "==", txId)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const donation = snapshot.docs[0];
        return new DonationModel({ id: donation.id, ...donation.data() });
      }
      return null;
    } catch (error) {
      throw new DatabaseError(`Erro ao buscar doação por TxId: ${error}`);
    }
  }

  /**
   * Recupera todas as doações com paginação.
   *
   * @param {number} [page=1] - O número da página atual.
   * @param {number} [limit=10] - O número de parceiros por página.
   * @returns {Promise<{donations: DonationModel[], currentPage: number, totalPages: number, totalResults: number, limit: number}>} Lista paginada de doações
   * @throws {DatabaseError} Se ocorrer um erro relacionado ao banco de dados durante a recuperação.
   */
  static async allDonations(page = 1, limit = 15) {
    // Calcula o offset para a paginação
    const offset = (Math.max(1, page) - 1) * limit;
    const docRef = db.collection("donations");

    try {
      // Obtém a contagem total de documentos para calcular o total de páginas
      const countSnapshot = await docRef.count().get();
      const totalResults = countSnapshot.data().count;

      // Retorna um array vazio se não houver resultados
      if (totalResults === 0) {
        return {
          donations: [],
          currentPage: page,
          totalPages: 0,
          totalResults: 0,
          limit: limit,
        };
      }

      // Executa a consulta paginada e ordena por data de criação
      const snapshot = await docRef
        .orderBy("createdAt", "desc")
        .limit(limit)
        .offset(offset)
        .get();

      // Mapeia os documentos do banco de dados
      const donations = snapshot.docs.map(
        (doc) => new DonationModel({ id: doc.id, ...doc.data() })
      );

      // Calcula o total de páginas
      const totalPages = Math.ceil(totalResults / limit);

      return {
        donations: donations,
        currentPage: page,
        totalPages: totalPages,
        totalResults: totalResults,
        limit: limit,
      };
    } catch (error) {
      throw new DatabaseError(`Erro ao buscar todas as doações: ${error}`);
    }
  }

  /**
   *
   * @param {string} donorCIM - CIM do doador a ser buscado
   * @returns {Promise<DonationModel[]>} - Um array de doações relacionadas ao CIM do doador
   *                                       ou um array vazio se nenhuma doação for encontrada
   */

  static async findByDonorCIM(donorCIM) {
    const snapshot = await db
      .collection("donations")
      .orderBy("createdAt", "desc")
      .get();

    const searchCIM = donorCIM.trim();

    if (!snapshot.empty) {
      const allDonations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredDonations = allDonations.filter((donation) => {
        return donation.donorCIM && donation.donorCIM.includes(searchCIM);
      });

      const donations = filteredDonations.map(
        (docData) => new DonationModel(docData)
      );

      return donations;
    } else {
      return [];
    }
  }

  /**
   *
   * @param {string} donorCPF - O CPF do doador a ser buscado
   * @returns {Promise<DonationModel[]>} - Um array das doações relacionadasd ao CPF do doador
   *                                       ou um array vazio se nenhuma doação for encontrada
   */
  static async findByDonorCPF(donorCPF) {
    const snapshot = await db
      .collection("donations")
      .orderBy("createdAt", "desc")
      .get();

    const searchCPF = donorCPF.trim();

    if (!snapshot.empty) {
      const allDonations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredDonations = allDonations.filter((donation) => {
        return donation.donorCPF && donation.donorCPF.includes(searchCPF);
      });

      const donations = filteredDonations.map(
        (docData) => new DonationModel(docData)
      );

      return donations;
    } else {
      return [];
    }
  }

  /**
   * Busca doações através do nome do doador
   *
   * @param {string} donorName - O nome do doador
   * @returns {Promise<DonationModel[]>} - Array das doações que correspondem ao nome do doador
   *                                       ou um array vazio se nenhuma doação for encontrada
   */
  static async findByDonorName(donorName) {
    // Busca todas as doações e as filtra em memória
    const snapshot = await db
      .collection("donations")
      .orderBy("createdAt", "desc")
      .get();

    const searchName = donorName.toLowerCase().trim();

    if (!snapshot.empty) {
      const allDonations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Filtra as doações cujo nome do doador inclui o t ermo de busca
      const filteredDonations = allDonations.filter((donation) => {
        return (
          donation.donorName &&
          donation.donorName.toLowerCase().includes(searchName)
        );
      });
      const donations = filteredDonations.map(
        (docData) => new DonationModel(docData)
      );
      return donations;
    } else {
      return [];
    }
  }

  /**
   * Busca uma doação ou doações por ID, nome do doador ou ID de transação (TxId)
   * Tenta buscar por ID, depois por TxId e, por último, por nome do doador
   *
   * @param {string} searchTerm - Termo a ser buscado (pode ser CIM, CPF, nome ou parte do nome do doador)
   * @param {number} [page=1] - Número da página a ser retornada
   * @param {number} [limit=15] - Número de resultados por página
   * @returns {Promise<{donations: DonationModel[], currentPage: number, totalPages: number, totalResults: number, limit: number}>}
   *          - Um array paginado contendo as doações encontradas
   * @throws {ValidationError} - Se o termo de busca for vazio ou inválido
   */
  static async searchDonations(searchTerm, page = 1, limit = 15) {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) {
      throw new ValidationError("O termo de busca não pode ser vazio");
    }
    const offset = (Math.max(1, page) - 1) * limit;

    let foundDonations = [];

    // Tenta buscar por CIM
    const donationByDonorCIM = await this.findByDonorCIM(trimmedSearchTerm);
    if (Array.isArray(donationByDonorCIM) && donationByDonorCIM.length > 0) {
      foundDonations = donationByDonorCIM.slice(offset, offset + limit);
    }

    // Se não encontrar por CIM, tenta buscar por CPF
    if (foundDonations.length === 0) {
      const donationByDonorCPF = await this.findByDonorCPF(trimmedSearchTerm);
      if (Array.isArray(donationByDonorCPF) && donationByDonorCPF.length > 0) {
        foundDonations = donationByDonorCPF.slice(offset, offset + limit);
      }
    }

    // Se não encontrar por CPF, tenta buscar pelo nome do doador
    if (foundDonations.length === 0) {
      const donationByDonorName = await this.findByDonorName(trimmedSearchTerm);
      if (
        Array.isArray(donationByDonorName) &&
        donationByDonorName.length > 0
      ) {
        foundDonations = donationByDonorName.slice(offset, offset + limit);
      }
    }

    const totalFound = foundDonations.length;
    // Padroniza o retorno: sempre um objeto de paginação
    const totalPages = Math.ceil(totalFound / limit);

    return {
      donations: foundDonations,
      currentPage: page,
      totalPages: totalPages,
      totalResults: totalFound,
    };
  }

  /**
   * Busca doações dentro de um perído de data especificado com paginação
   *
   * @param {string} startDateString - Data inicial
   * @param {string} endDateString - Data finla
   * @param {number} [page=1] - Número da página a ser retornada
   * @param {number} [limit=15] - Número de resultados por página
   * @returns {Promise<donations: DonationModel[], currentPage: number, totalPages: number, totalResults: number, limit: number>}
   *            - Lista paginada de doações dentro do período
   * @throws {ValidationError} - Se as datas de entrada forem inválidas ou incompletas
   * @throws {DatabaseError} - Se ocorrer um erro na comunicação com o banco de dados
   */
  static async getDonationsByDateRange(
    startDateString,
    endDateString,
    page = 1,
    limit = 15
  ) {
    if (!startDateString || !endDateString) {
      throw new ValidationError(
        "As datas de início e fim são obrigatórias para o filtro."
      );
    }

    const startDate = new Date(`${startDateString}T00:00:00.000Z`);
    const endDate = new Date(`${endDateString}T23:59:59.999Z`);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      throw new ValidationError("Data Inválida!");
    }

    const startDateTimestamp = Timestamp.fromDate(startDate);
    const endDateTimeStamp = Timestamp.fromDate(endDate);

    const offset = (Math.max(1, page) - 1) * limit;

    try {
      const collectionRef = db.collection("donations");
      const countSnapshot = await collectionRef
        .where("createdAt", ">=", startDateTimestamp)
        .where("createdAt", "<=", endDateTimeStamp)
        .count()
        .get();
      const totalResults = countSnapshot.data().count;

      if (totalResults === 0) {
        return {
          donations: [],
          currentPage: page,
          totalPages: 0,
          totalResults: 0,
          limit: limit,
        };
      }

      // Busca paginada das doações
      const snapshot = await collectionRef
        .where("createdAt", ">=", startDateTimestamp)
        .where("createdAt", "<=", endDateTimeStamp)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .offset(offset)
        .get();

      const donations = snapshot.docs.map(
        (doc) => new DonationModel({ id: doc.id, ...doc.data() })
      );

      const totalPages = Math.ceil(totalResults / limit);

      return {
        donations: donations,
        currentPage: page,
        totalPages: totalPages,
        totalResults: totalResults,
        limit: limit,
      };
    } catch (error) {
      throw new DatabaseError(
        `Erro ao buscar doações por período de data: ${error}`
      );
    }
  }

  /**
   * Calcula a evolução das doações nos últimos seis meses.
   *
   * @returns {Promise<object[]>} - Um array contendo dados de doação para cada mês
   * @throws {DatabaseError} - Se ocorrer um erro ao obter os dados de evoluçao
   */
  static async donationEvolution() {
    try {
      const currentDate = new Date();
      const sixMonthsAgo = new Date();

      sixMonthsAgo.setMonth(currentDate.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Garante que comece no primeiro dia do mês
      const startDateTimestamp = Timestamp.fromDate(sixMonthsAgo); // Zera as horas para pegar o início do dia

      const snapshot = await db
        .collection("donations")
        .where("createdAt", ">=", startDateTimestamp)
        .orderBy("createdAt", "asc")
        .get();

      const monthlyData = {};

      snapshot.docs.forEach((doc) => {
        const donation = new DonationModel({ id: doc.id, ...doc.data() });
        // Conversão de Timestap para Date
        const createdAtDate = new Date(donation.createdAt);
        const year = createdAtDate.getFullYear();
        const month = createdAtDate.getMonth() + 1;

        const key = `${year}-${String(month).padStart(2, "0")}`;

        if (!monthlyData[key]) {
          monthlyData[key] = {
            month: month,
            year: year,
            totalDonations: 0,
            totalAmount: 0,
          };
        }
        monthlyData[key].totalDonations += 1;
        monthlyData[key].totalAmount += donation.amount;
      });
      // Caso o mês não tenha doações
      const result = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(currentDate.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, "0")}`;

        result.unshift(
          monthlyData[key] || {
            month: month,
            year: year,
            totalDonations: 0,
            totalAmount: 0,
          }
        );
      }

      return result;
    } catch (error) {
      throw new DatabaseError(`Erro ao obter evolução das doações: ${error}`);
    }
  }
}

export default DonationService;
