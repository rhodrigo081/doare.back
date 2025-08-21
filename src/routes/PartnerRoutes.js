import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { PartnerService } from "../service/PartnerService.js";
const router = express.Router();

router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const { search } = req.query;

    if (search) {
      const result = await PartnerService.searchPartners(search, page, limit);
      return res.status(200).json(result);
    }

    const allPartners = await PartnerService.allpartners(page, limit);
    return res.status(200).json(allPartners);
  } catch (error) {
    next(error);
  }
});

router.get("/cpf/:cpf", async (req, res, next) => {
  const { cpf } = req.params

  try{
    const result = await PartnerService.findByExactCPF(cpf)
    return res.status(200).json(result);
  } catch(error){
    next(error);
  }
  
})

router.post("/cadastrar", authenticateToken, async (req, res, next) => {
  try {
    const { cpf, name, cim, degree, profession, dateOfBirth } = req.body;

    const partnerDetails = await PartnerService.createPartner({
      cpf,
      name,
      cim,
      degree,
      profession,
      dateOfBirth,
    });

    res.status(201).json(partnerDetails);
  } catch (error) {
    next(error);
  }
});

router.put("/atualizar/:id", authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const updatePartner = await PartnerService.updatePartner(id, updates);
    res.status(200).json(updatePartner);
  } catch (error) {
    next(error);
  }
});

router.delete("/remover", authenticateToken, async (req, res, next) => {
  try {
    const { ids } = req.body;

    const result = await PartnerService.deletePartners(ids);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/evolucao", authenticateToken, async (req, res ,next) => {
  try{
    const evolutionData = await PartnerService.partnersEvolution();
    res.status(200).json(evolutionData)
  } catch(error){
    next(error);
  }
})

export default router;
