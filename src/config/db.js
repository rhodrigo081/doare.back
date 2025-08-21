import admin from "firebase-admin";
import { logger } from "../utils/Logger.js";
import { config } from "dotenv";
config();

const serviceAccountJsonString = process.env.FIREBASE_ACCOUNT_JSON;

// Verifica se o conteúdo JSON está definido
if (!serviceAccountJsonString) {
  logger.fatal(
    "Erro: A variável de ambiente FIREBASE_ACCOUNT_JSON não está definida ou está vazia. Não foi possível carregar o banco de dados."
  );
}

// Armazena as credenciais
let serviceAccount;

// Tratamento da inicialização do banco de dados
try {
  serviceAccount = JSON.parse(serviceAccountJsonString);

  // Inicializa o banco de dados
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.success("Banco de dados inicializado com sucesso!");
  } else {
    logger.info("Banco de dados já está em execução!");
  }
} catch (error) {
  logger.fatal(
    `Falha ao inicializar Banco de dados. Verifique se o JSON na variável de ambiente está formatado corretamente: ${error.message}`
  );
  // Saia do processo para indicar que a inicialização falhou criticamente
  process.exit(1);
}

export default admin;
