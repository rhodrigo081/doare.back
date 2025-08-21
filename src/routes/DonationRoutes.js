import express from "express";
const router = express.Router();
import DonationService from "../service/DonationService.js";
import { authenticateToken } from "../middleware/auth.js";

router.get("/", authenticateToken, async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const { startDate, endDate, search } = req.query;
  let result;

  if (search) {
    result = await DonationService.searchDonations(search, page, limit);
    return res.status(200).json(result);
  }
  if (startDate && endDate) {
    result = await DonationService.getDonationsByDateRange(
      startDate,
      endDate,
      page,
      limit
    );
    return res.status(200).json(result);
  }

  const allDonations = await DonationService.allDonations(page, limit);
  return res.status(200).json(allDonations);
});

/**
 * Rota POST /doacoes/gerar
 * Gera Nova cobrança pix para uma doação
 * @param {object} req.body - Dados da doação no corpo da requisição
 * @param {string} req.body.donorName - Nome do doador
 * @param {number} req.body.amount - Valor da doação
 * @returns {201} - Mensagem de sucesso
 * @returns {400} - Erro de validação
 * @returns {502} - Erro de serviço externo
 * @returns {500} - Erro interno
 */
router.post("/gerar", async (req, res, next) => {
  try {
    const { donorCPF, amount } = req.body;

    const pixDetails = await DonationService.createDonation({
      donorCPF,
      amount,
    });

    res.status(201).json({
      donorName: pixDetails.donorName,
      donorCIM: pixDetails.donorCIM,
      value: amount,
      txId: pixDetails.txId,
      qrCode: pixDetails.qrCode,
      copyPaste: pixDetails.copyPaste,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/evolucao", authenticateToken, async (req, res, next) => {
  try {
    const evolutionData = await DonationService.donationEvolution();
    res.status(200).json(evolutionData);
  } catch (error) {
    next(error);
  }
});
export default router;
