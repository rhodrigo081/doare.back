import app from "./src/app.js"; 
import webhookConfig from "./src/middleware/EFIAuth.js"; 
const PORT = process.env.PORT;

app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  try {
    webhookConfig();
  } catch (error) {
    throw new ExternalError(`Erro ao configurar webhook: `);
  }
});
