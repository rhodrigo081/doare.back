import admin from "../config/db.js";
const db = admin.firestore();
import {
  ValidationError,
  DatabaseError,
  NotFoundError,
} from "../utils/Errors.js";
import PartnerModel from "../models/Partner.js";
import Degree from "../utils/Degrees.js";
import { cpf as validator } from "cpf-cnpj-validator";
import { Timestamp } from "firebase-admin/firestore";

export class PartnerService {
  /**
   * Cria um novo parceiro no banco de dados.
   *
   * @param {object} data - Os dados do parceiro.
   * @param {string} data.cpf - O CPF do parceiro.
   * @param {string} data.name - O nome do parceiro.
   * @param {string} data.cim - O CIM (Cadastro de Imposto Municipal) do parceiro.
   * @param {string} data.degree - O grau de formação do parceiro.
   * @param {string} [data.profession] - A profissão do parceiro.
   * @param {string} [data.dateOfBirth] - A data de nascimento do parceiro.
   * @returns {Promise<PartnerModel>} O parceiro recém-criado.
   * @throws {ValidationError} Se algum campo obrigatório estiver faltando, o CPF for inválido ou já existir.
   * @throws {DatabaseError} Se ocorrer um erro relacionado ao banco de dados durante a criação.
   */
  static async createPartner(data) {
    const { cpf, name, cim, degree, profession, dateOfBirth } = data;
    if (!cpf || !name || !cim || !degree) {
      throw new ValidationError(
        "Todos os campos obrigatórios (CPF, nome, CIM, grau) devem ser preenchidos!"
      );
    }

    const cleanedCPF = cpf.replace(/\D/g, "");
    if (cleanedCPF.length !== 11 || !validator.isValid(cleanedCPF)) {
      throw new ValidationError(
        "CPF Inválido! Deve conter 11 dígitos numéricos válidos."
      );
    }
    const validDegree = Object.values(Degree);
    if (!validDegree.includes(degree)) {
      throw new ValidationError(
        `O grau deve ser um dos seguintes: ${validDegree.join(", ")}.`
      );
    }

    let existingPartner = await this.findByExactCPF(cleanedCPF);
    if (existingPartner) {
      throw new ValidationError("Um parceiro com este CPF já existe!");
    }

    existingPartner = await this.findByExactCIM(cim);
    if (existingPartner) {
      throw new ValidationError("Um parceiro com este CIM já existe!");
    }

    const professionToSave = profession ?? null;

    let validatedDateOfBirth = null;

    if (dateOfBirth) {
      const parsedDate = new Date(dateOfBirth);

      if (isNaN(parsedDate.getTime())) {
        throw new ValidationError(
          "Data de Nascimento Inválida: Formato incorreto. Use YYYY-MM-DD."
        );
      }

      const dateOfBirthUTC = new Date(
        Date.UTC(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate()
        )
      );

      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      );

      if (dateOfBirthUTC > todayUTC) {
        throw new ValidationError(
          "Data de Nascimento Inválida: Não pode ser uma data futura."
        );
      }

      validatedDateOfBirth = dateOfBirthUTC;
    }

    try {
      const newPartner = new PartnerModel({
        cpf: cleanedCPF,
        name,
        cim,
        degree,
        profession: professionToSave,
        dateOfBirth: validatedDateOfBirth,
      });

      const savedPartner = await newPartner.save();
      return savedPartner;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Erro ao cadastrar parceiro: ${error.message || error}`
      );
    }
  }

  /**
   * Recupera todos os parceiros com paginação.
   *
   * @param {number} [page=1] - O número da página atual.
   * @param {number} [limit=15] - O número de parceiros por página.
   * @returns {Promise<{partners: PartnerModel[], currentPage: number, totalPages: number, totalResults: number, limit: number}>} Lista paginada de parceiros.
   * @throws {DatabaseError} Se ocorrer um erro relacionado ao banco de dados durante a recuperação.
   */
  static async allpartners(page = 1, limit = 15) {
    // Calcula o offset para paginação
    const offset = (Math.max(1, page) - 1) * limit;
    const docRef = db.collection("partners");

    try {
      // Obtém a contagem total de documentos para calcular o total de páginas
      const countSnapshot = await docRef.count().get();
      const totalResults = countSnapshot.data().count;

      // Retorna um array vazio se não houver resultados
      if (totalResults === 0) {
        return {
          partners: [],
          currentPage: page,
          totalPages: 0,
          totalResults: 0,
          limit: limit,
        };
      }

      // Executa a consulta pagina e ordena por data de criação
      const snapshot = await docRef
        .orderBy("createdAt", "desc")
        .limit(limit)
        .offset(offset)
        .get();

      // Mapeia os documentos do banco de dados
      const partners = snapshot.docs.map(
        (doc) => new PartnerModel({ id: doc.id, ...doc.data() })
      );

      // Calcula o total de páginas
      const totalPages = Math.ceil(totalResults / limit);

      return {
        partners: partners,
        currentPage: page,
        totalPages: totalPages,
        totalResults: totalResults,
        limit: limit,
      };
    } catch (error) {
      throw new DatabaseError(`Erro ao buscar todos os parceiros: ${error}`);
    }
  }

  static async findByExactCPF(cpf) {
    try {
      const snapshot = await db
        .collection("partners")
        .where("cpf", "==", cpf)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const partner = snapshot.docs[0];
        return new PartnerModel({ id: partner.id, ...partner.data() });
      }
      return null;
    } catch (error) {
      throw new DatabaseError(`Erro ao buscar parceiro: ${error}`);
    }
  }

  static async findByExactCIM(cim) {
    try {
      const snapshot = await db
        .collection("partners")
        .where("cim", "==", cim)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const partner = snapshot.docs[0];
        return new PartnerModel({ id: partner.id, ...partner.data() });
      }
      return null;
    } catch (error) {
      throw new DatabaseError(`Erro ao buscar parceiro: ${error}`);
    }
  }

  /**
   * Busca um parceiro específico pelo seu CIM.
   *
   * @param {string} cim - O CIM do parceiro a ser buscado.
   * @returns {Promise<PartnerModel[]>} - Um array de parceiros relacionados ao CIM pesquisado
   *                                      ou um array vazio se nenhum parceiro for encontrado
   */
  static async findByCIM(cim) {
    const snapshot = await db
      .collection("partners")
      .orderBy("createdAt", "desc")
      .get();

    const searchCIM = cim.trim();

    if (!snapshot.empty) {
      const allPartners = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredPartners = allPartners.filter((partner) => {
        return partner.cim && partner.cim.includes(searchCIM);
      });

      const partners = filteredPartners.map(
        (docData) => new PartnerModel(docData)
      );

      return partners;
    } else {
      return [];
    }
  }

  /**
   * Busca um parceiro pelo seu CPF.
   *
   * @param {string} cpf - O CPF do parceiro a ser buscado.
   * @returns {Promise<PartnerModel[]>} - Um array de parceiros relacionados ao CPF pesquisado
   *                                      ou um array vazio se nenhuma doação for encontrada
   */
  static async findByCPF(cpf) {
    const snapshot = await db
      .collection("partners")
      .orderBy("createdAt", "desc")
      .get();

    const searchCPF = cpf.trim();

    if (!snapshot.empty) {
      const allPartners = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredPartners = allPartners.filter((partner) => {
        return partner.cpf && partner.cpf.includes(searchCPF);
      });

      const partners = filteredPartners.map(
        (docData) => new PartnerModel(docData)
      );

      return partners;
    } else {
      return [];
    }
  }

  /**
   * Busca parceiros através do nome.
   *
   * @param {string} name - O nome do parceiro.
   * @returns {Promise<PartnerModel[]>} - Um array de parceiros que correspondem ao nome pesquisado
   *                                      ou um arra vazio se nenhum doador for encontrado
   */
  static async findByName(name) {
    const snapshot = await db.collection("partners").get();

    const searchName = name.toLowerCase().trim();

    if (!snapshot.empty) {
      const allPartners = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filteredPartners = allPartners.filter((partner) => {
        return partner.name && partner.name.toLowerCase().includes(searchName);
      });

      const partners = filteredPartners.map(
        (docData) => new PartnerModel(docData)
      );

      return partners;
    } else {
      return [];
    }
  }

  /**
   * Busca um parceiro ou parceiros por CIM, CPF ou nome.
   *
   * @param {string} searchTerm - Termo a ser buscado (pode ser CIM, CPF ou nome).
   * @param {number} [page=1] - Número da página a ser retornada.
   * @param {number} [limit=15] - Número de resultados por página.
   * @returns {Promise<{partners: PartnerModel[], currentPage: number, totalPages: number, totalResults: number}>} Uma lista paginada de parceiros encontrados.
   * @throws {ValidationError} Se o termo de busca for vazio ou inválido.
   */
  static async searchPartners(searchTerm, page = 1, limit = 15) {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) {
      throw new ValidationError("O termo de busca não pode ser vazio");
    }
    const offset = (Math.max(1, page) - 1) * limit;

    let foundPartners = [];

    // Tenta buscar por CIM
    const partnerByCIM = await this.findByCIM(trimmedSearchTerm);
    if (Array.isArray(partnerByCIM) && partnerByCIM.length > 0) {
      foundPartners = partnerByCIM.slice(offset, offset + limit);
    }

    // Se não encontrou por CIM, tenta buscar por CPF
    if (foundPartners.length === 0) {
      const partnerByCPF = await this.findByCPF(trimmedSearchTerm);
      if (Array.isArray(partnerByCPF) && partnerByCPF.length > 0) {
        foundPartners = partnerByCPF.slice(offset, offset + limit);
      }
    }

    // Se não encontrou por CIM ou CPF, tenta buscar por nome
    if (foundPartners.length === 0) {
      const partnersByName = await this.findByName(trimmedSearchTerm);
      if (Array.isArray(partnersByName) && partnersByName.length > 0) {
        foundPartners = partnersByName.slice(offset, offset + limit);
      }
    }

    const totalFound = foundPartners.length;
    const totalPages = Math.ceil(totalFound / limit);

    return {
      partners: foundPartners,
      currentPage: page,
      totalPages: totalPages,
      totalResults: totalFound,
    };
  }

  /**
   *Atualiza as informações de um parceiro existente
   *
   * @param {string} id - ID do parceiro a ser atualizado
   * @param {object} updates - Um objeto com os campos a sere atualizados
   * @param {string} [updates.cpf] - Novo CPF do parceiro
   *  @param {string} [updates.name] - Novo nome do parceiro
   *  @param {string} [updates.cim] - Novo CIM do parceiro
   *  @param {string} [updates.degree] - Novo grau de formação de parceiro
   *  @param {string} [updates.profession] - Nova profissão do parceiro
   *  @param {string} [updates.dateOfBirth] - Nova data de nascimento do parceiro
   * @returns {Promise<PartnerModel>} - Parceiro atualizado
   * @throws {NotFoundError} - Se nenhum parceiro for encontrado
   * @throws {ValidationError} - Se houver problemas com a validação dos dados
   * @throws {DatabaseError} - Se ocorer um erro na comunicação com o banco de dados
   */
  static async updatePartner(id, updates) {
    const docRef = db.collection("partners").doc(id);

    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new NotFoundError(`Parceiro com ${id} não encontrado`);
    }

    if (updates.degree) {
      const validDegree = Object.values(Degree);
      if (!validDegree.includes(updates.degree)) {
        throw new ValidationError(`O grau deve ser: ${validDegree.join()}`);
      }
    }

    if (updates.cpf && updates.cpf !== docSnap.data().cpf) {
      let existingPartner = await this.findByCPF(updates.cpf);
      if (existingPartner || !validator.isValid(updates.cpf)) {
        throw new ValidationError("CPF Inválido!");
      }
    }

    if (updates.cim && updates.cim !== docSnap.data().cim) {
      const existingPartnerByCIM = await this.findByCIM(updates.cim);
      if (existingPartnerByCIM && existingPartnerByCIM.id !== id) {
        throw new ValidationError("Já existe um parceiro com este CIM!");
      }
    }

    let validatedDateOfBirth = null;

    if (updates.dateOfBirth) {
      const parsedDate = new Date(updates.dateOfBirth);

      if (isNaN(parsedDate.getTime())) {
        throw new ValidationError(
          "Data de Nascimento Inválida: Formato incorreto. Use YYYY-MM-DD."
        );
      }

      const dateOfBirthUTC = new Date(
        Date.UTC(
          parsedDate.getFullYear(),
          parsedDate.getMonth(),
          parsedDate.getDate()
        )
      );

      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
      );

      if (dateOfBirthUTC > todayUTC) {
        throw new ValidationError(
          "Data de Nascimento Inválida: Não pode ser uma data futura."
        );
      }

      validatedDateOfBirth = dateOfBirthUTC;
    }

    if (validatedDateOfBirth !== null) {
      updates.dateOfBirth = validatedDateOfBirth;
    }

    await docRef.update(updates);
    const updatedDocSnap = await docRef.get();
    return new PartnerModel({
      id: updatedDocSnap.id,
      ...updatedDocSnap.data(),
    });
  }

  /**
   * Deleta um ou mais parceiros
   *
   * @param {string | string[]} partnerIds - ID de um ou mais parceiros a ser deletado
   * @returns {Promise<{message: string, deletedCount: number}>} - Uma mensagem de sucesso
   * @throws {ValidationError} - Se o ID fornecido for inválido
   * @throws {NotFoundError} - Se nenhum parceiro for encontrado
   * @throws {DatabaseError} - Se ocorrer um erro relacionado ao banco de dados
   */
  static async deletePartners(partnerIds) {
    let idsToDelete = [];

    if (typeof partnerIds === "string" && partnerIds.trim() !== "") {
      idsToDelete.push(partnerIds.trim());
    } else if (Array.isArray(partnerIds) && partnerIds.length > 0) {
      idsToDelete = partnerIds
        .filter((id) => typeof id === "string" && id.trim() !== "")
        .map((id) => id.trim());
    } else {
      throw new ValidationError(
        "O(s) ID(s) do parceiro é/são obrigatório(s) e deve(m) ser uma string ou um array de strings válidas."
      );
    }

    if (idsToDelete.length === 0) {
      throw new ValidationError(
        "Nenhum ID de parceiro válido foi fornecido para exclusão."
      );
    }

    let deletedCount = 0;
    const notFoundIds = [];

    try {
      for (const id of idsToDelete) {
        const docRef = db.collection("partners").doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          await docRef.delete();
          deletedCount++;
        } else {
          notFoundIds.push(id);
        }
      }

      if (deletedCount === 0 && notFoundIds.length > 0) {
        throw new NotFoundError(
          `Nenhum parceiro encontrado para o(s) ID(s) fornecido(s): ${notFoundIds.join(
            ", "
          )}.`
        );
      } else if (deletedCount > 0 && notFoundIds.length > 0) {
        return {
          message: `${deletedCount} parceiro(s) deletado(s) com sucesso. ID(s) não encontrado(s): ${notFoundIds.join(
            ", "
          )}.`,
          deletedCount: deletedCount,
        };
      } else {
        return {
          message: `${deletedCount} parceiro(s) deletado(s) com sucesso.`,
          deletedCount: deletedCount,
        };
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Erro ao deletar parceiro(s): ${error.message || error}`
      );
    }
  }

  static async partnersEvolution() {
    try {
      const currentDate = new Date();
      const sixMonthsAgo = new Date();

      sixMonthsAgo.setMonth(currentDate.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Garante que comece no primeiro dia do mês
      const startDateTimestamp = Timestamp.fromDate(sixMonthsAgo); // Zera as horas para pegar o início do dia

      const snapshot = await db
        .collection("partners")
        .where("createdAt", ">=", startDateTimestamp)
        .orderBy("createdAt", "asc")
        .get();

      const monthlyData = {};

      snapshot.docs.forEach((doc) => {
        const partner = new PartnerModel({ id: doc.id, ...doc.data() });
        // Conversão de Timestap para Date
        const createdAtDate = new Date(partner.createdAt);
        const year = createdAtDate.getFullYear();
        const month = createdAtDate.getMonth() + 1;

        const key = `${year}-${String(month).padStart(2, "0")}`;

        if (!monthlyData[key]) {
          monthlyData[key] = {
            month: month,
            year: year,
            totalPartners: 0,
          };
        }
        monthlyData[key].totalPartners += 1;
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
            totalPartners: 0,
          }
        );
      }

      return result;
    } catch (error) {
      throw new DatabaseError(`Erro ao obter evolução das doações: ${error}`);
    }
  }
}
