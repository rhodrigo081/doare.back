import express from "express";
import sseService from "../service/SSEService.js";

const router = express.Router();

router.get("/:txId", (req, res) => {
  const { txId } = req.params;
  sseService.addClient(txId, req, res);
});

export default router;
