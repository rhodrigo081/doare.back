import express from "express";
import cors from "cors";
import errorHandler from "./middleware/ErrorHandler.js";

import "./config/db.js";
import "./config/efipay.js";

import login from "./routes/LoginRoutes.js";
import donationRoutes from "./routes/DonationRoutes.js";
import webhook from "./routes/Webhook.js";
import partnerRoutes from "./routes/PartnerRoutes.js";
import sseRoutes from "./routes/SSERoutes.js";
import exportRoutes from "./routes/ExportRoutes.js";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(cookieParser());

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length && req.originalUrl.startsWith("/api/webhook/pix")) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

app.use(
  express.json({
    verify: rawBodySaver,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    verify: rawBodySaver,
  })
);

app.use(errorHandler);
app.use("/", login);
app.use("/doacoes", donationRoutes);
app.use("/parceiros", partnerRoutes);
app.use("/api/webhook", webhook);
app.use("/sse", sseRoutes);
app.use("/relatorio", exportRoutes);
app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ message: "API está online!" });
});

app.use((req, res, next) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  console.error("Erro na aplicação:", err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || "Erro interno do servidor.",
  });
});

app.use((req, res, next) => {
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");
  next();
});

export default app;
