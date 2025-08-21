import initializeEfi from "../config/efipay.js";
import { v4 as uuidv4 } from "uuid";
import { ExternalError } from "../utils/Errors.js";

// Gerencia as operaçoes relacionadas ao pix
class PixService {
  constructor() {
    this.efi = initializeEfi;
  }

  /**
   * Cria uma nova cobrança imediata ( QR Code dinâmico)
   * @param {object} pixData - Dados necessários para a cobrança
   * @param {string} pixData.amount - Valor da cobrança
   * @param {string} pixData.donorCPF - CPF do doador
   * @param {string} pixData.donorName - Nome do doador
   * @returns {Promise<object>} - Detalhes esseciais da cobrança Pix
   * @throws {ExternalError} - Lança um erro com os detalhes sobre a falha da comunicação com a API EFI
   */
  async createImmediatePixCharge(pixData) {
    const { amount, donorCPF, donorName } = pixData;
    // Gera o ID de transação único
    const uniqueTxId = uuidv4().replace(/-/g, "");

    // Prepara o corpo da requisição
    const pixBody = {
      calendario: { expiracao: 3600 },
      devedor: {
        cpf: donorCPF,
        nome: donorName,
      },
      valor: { original: parseFloat(amount).toFixed(2) },
      chave: process.env.GN_PIX_KEY,
      solicitacaoPagador: `Doação Realizada por: ${donorName}`,
    };

    console.log(
      "[PixService] pixBody enviado para Efí:",
      JSON.stringify(pixBody, null, 2)
    );
    try {
      // Chama o método da API EFI para criar a cobrança Pix
      const chargeResponse = await this.efi.pixCreateCharge(
        { txid: uniqueTxId },
        pixBody
      );

      // Extrai os dados esseciais da resposta da API
      const txId = chargeResponse.txid;
      const locId = chargeResponse.loc || chargeResponse.loc.id;
      const qrCodeImage = chargeResponse.location;
      const copyPastePix = chargeResponse.pixCopiaECola;
      const createdAt =
        chargeResponse.calendario || chargeResponse.calendario.criacao;

      if (!txId || !locId || !qrCodeImage || !copyPastePix || !createdAt) {
        throw new ExternalError(
          "Falha ao obter dados Pix essenciais da Efí. Resposta incompleta ou inesperada."
        );
      }

      return {
        txId,
        locId,
        qrCode: qrCodeImage,
        copyPaste: copyPastePix,
        createdAt,
      };
    } catch (error) {
      throw new ExternalError(
        `Erro interno ao preparar Pix: ${
          error.message || JSON.stringify(error)
        }`
      );
    }
  }

  /**
   * @param {string} txId - Id da transação Pix
   * @returns {Promise<object>} - Objeto contendo todos os detalhes da cobrança
   * @throws {ExternalError} - Lança um erro com os detalhes sobre a falha da comunicação com a API EFI
   */
  async getPixDetails(txId) {
    try {
      // Chama o método da API EFI para detalhar uma cobrança Pix
      const response = await this.efi.pixDetailCharge({
        txid: txId,
      });
      return response; // Resosta da API
    } catch (error) {
      if (error.response && error.response.data) {
        const apiError = error.response.data;
        const errorName =
          apiError.nome || apiError.name || "Erro desconhecido da API";
        const errorDetail =
          apiError.mensagem || apiError.message || JSON.stringify(apiError);
        throw new ExternalError(
          `Erro API Efí ao consultar Pix: ${errorName} - ${errorDetail} (Status: ${error.response.status})`
        );
      }
      throw new ExternalError(
        `Erro inesperado ao consultar Pix: ${
          error.message || "Erro desconhecido"
        }`
      );
    }
  }
}

export default new PixService();