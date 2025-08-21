import express from "express";
const router = express.Router();
import DonationService from "../service/DonationService.js";
import sseService from "../service/sseService.js";
const donationServiceInstance = new DonationService();
/**
 * Rota POST /api/webhook
 * Ponto de entrada base para configuração de webhooks
 * @returns {200} - Confirma que o webhook base está configurado
 */
router.post("/", async (req, res) => {
  res
    .status(200)
    .send(
      "Webhook base configurado. Aguardando notificações em /api/webhook/pix."
    );
});

/**
 * Rota POST /api/webhook/pix
 * Lida com notificações de webhook de pagamento
 * @param {object} req.body - O payload completo da notificação
 * @param {Array<object>} req.body.pix - Um array de objetos notificação Pix
 * @returns {200} - Confirmação de recebimento
 * @returns {500} - Erro interno
 */
router.post("/pix", async (req, res) => {
  try {
    const pixNotificationData = req.body.pix;

    if (
      !Array.isArray(pixNotificationData) ||
      pixNotificationData.length === 0
    ) {
      console.warn(
        "[Webhook Pix] Nenhum dado de notificação PIX válido no payload."
      );
      return res.status(200).send("Nenhum dado de notificação processado.");
    }

    let successfulProcesses = 0;
    const failedTxIds = [];
    const processedDonationsForSSE = [];

    for (const pixPayload of pixNotificationData) {
      const txId = pixPayload.txid;

      if (!txId) {
        console.warn(
          "[Webhook Pix] Payload PIX recebido sem txId. Ignorando:",
          pixPayload
        );
        continue;
      }

      try {
        const donation = await donationServiceInstance.handlePixWebhook(
          pixPayload
        );

        if (donation && donation.status === "PAGA") {
          processedDonationsForSSE.push({
            txid: donation.txId,
            valor: donation.amount,
            pagador: donation.donorName,
            horario: donation.createdAt,
            status: donation.status,
          });
        }

        successfulProcesses++;
      } catch (error) {
        console.error(`[Webhook Pix - TxId ${txId}] Erro ao processar:`, error);
        failedTxIds.push(txId);
      }
    }

    if (processedDonationsForSSE.length > 0) {
      sseService.notifyDonationPaid(processedDonationsForSSE);
    }

    if (successfulProcesses > 0 && failedTxIds.length === 0) {
      res.status(200).send("Pix recebido e processado com sucesso.");
    } else if (successfulProcesses > 0 && failedTxIds.length > 0) {
      res
        .status(200)
        .send(
          `Pix recebido. ${successfulProcesses} processados com sucesso. Falha em ${
            failedTxIds.length
          } transações: [${failedTxIds.join(", ")}].`
        );
    } else {
      res
        .status(200)
        .send(
          "Nenhuma notificação Pix válida para processamento encontrada ou todas falharam."
        );
    }
  } catch (error) {
    console.error("[Webhook Pix] Erro interno fatal no router:", error);
    res.status(500).send("Erro interno ao processar o webhook.");
  }
});

export default router;
