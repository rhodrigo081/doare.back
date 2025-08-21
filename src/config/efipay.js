import fs from 'fs';
import os from 'os';
import path from 'path';
import Gerencianet from 'gn-api-sdk-node';
import { ValidationError } from '../utils/Errors.js';

const certBase64 = process.env.GN_CERTIFICATE_BASE64;
const certPassword = process.env.GN_CERTIFICATE_PASSWORD || "";

// Validar se o certificado está presente
if (!certBase64) {
  throw new ValidationError("Certificado Base64 não configurado (GN_CERTIFICATE_BASE64).");
}

// Cria arquivo temporário no diretório de arquivos temporários do sistema
// Esta é uma ótima solução para ambientes sem sistema de arquivos persistente, como a Vercel.
const certBuffer = Buffer.from(certBase64, 'base64');
const tempPath = path.join(os.tmpdir(), 'certificado.p12');
fs.writeFileSync(tempPath, certBuffer);

// Instancia o SDK com o caminho temporário do certificado
const efi = new Gerencianet({
  sandbox: process.env.GN_SANDBOX === "true",
  client_id: process.env.GN_CLIENT_ID,
  client_secret: process.env.GN_CLIENT_SECRET,
  certificate: tempPath, // agora é um caminho de arquivo real
  certificate_pass: certPassword,
});

// Exporta a instância 'efi' para que outros módulos possam usá-la
export default efi;