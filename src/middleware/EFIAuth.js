import axios from "axios";
import https from "https";
import { ExternalError, ValidationError } from "../utils/Errors.js";

const clientId = process.env.GN_CLIENT_ID;
const clientSecret = process.env.GN_CLIENT_SECRET;
const tokenUrl = process.env.TOKEN_URL;
const authWebhookUrl = process.env.GN_AUTHWEBHOOK_URL;
const publicWebhookUrl = process.env.GN_WEBHOOK_URL;
const certBase64 = process.env.GN_CERTIFICATE_BASE64;
const certPass = process.env.GN_CERTIFICATE_PASSWORD;

if (
  !clientId ||
  !clientSecret ||
  !tokenUrl ||
  !authWebhookUrl ||
  !publicWebhookUrl ||
  !certBase64
) {
  throw new ValidationError("Credenciais ou certificado Base64 ausentes.");
}

let accessToken = null;
let tokenExpiresAt = 0;
let httpsAgent = null;

function initializeHttpsAgent() {
  if (httpsAgent) return;

  try {
    httpsAgent = new https.Agent({
      pfx: Buffer.from(certBase64, 'base64'), // Decodifica aqui
      passphrase: certPass,
    });
    console.log("[EFIAuth] HTTPS Agent configurado com certificado P12 (decodificado de Base64).");
  } catch (error) {
    throw new Error("Falha ao configurar o certificado P12: " + error.message);
  }
}

async function getToken() {
  initializeHttpsAgent();

  if (accessToken && Date.now() < tokenExpiresAt - 60 * 1000) {
    return accessToken;
  }

  console.log("[EFIAuth] Obtendo novo token da Efí...");

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const response = await axios.post(
      tokenUrl,
      {
        grant_type: "client_credentials",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        httpsAgent: httpsAgent,
      }
    );

    const { access_token, expires_in } = response.data;

    if (access_token && expires_in) {
      accessToken = access_token;
      tokenExpiresAt = Date.now() + expires_in * 1000;
      return access_token;
    } else {
      throw new ExternalError("Resposta incompleta da API de token da Efí.");
    }
  } catch (error) {
    throw new ExternalError(`Erro ao obter token: ${error.message}`);
  }
}

export async function webhookConfig() {
  initializeHttpsAgent();

  const token = await getToken();

  if (!token) {
    console.warn("[EFIAuth] Token inválido. Webhook não configurado.");
    return;
  }

  try {
    await axios.put(
      authWebhookUrl,
      {
        webhookUrl: publicWebhookUrl,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        httpsAgent: httpsAgent,
      }
    );

    console.log("[EFIAuth] Webhook configurado com sucesso.");
  } catch (error) {
    console.error(
      "[EFIAuth] Erro ao configurar webhook:",
      error.response?.data || error.message
    );
    throw new ExternalError(
      `Erro inesperado ao configurar webhook: ${error.message}`
    );
  }
}

export default webhookConfig;