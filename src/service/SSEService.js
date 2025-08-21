class SSEService {
  constructor() {
    this.clients = new Map();
  }

  addClient(txId, req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: Conexão SSE estabelecida para txId: ${txId}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(": ping\n\n");
    }, 30000);

    // Usa Map para armazenar o cliente, para uma busca mais rápida.
    this.clients.set(txId, { res, keepAlive });

    req.on("close", () => {
      clearInterval(keepAlive);
      this.clients.delete(txId);
      console.log(`[SSEService] Cliente com txId ${txId} desconectado.`);
    });
  }

  notifyDonationPaid(donations) {
    if (!Array.isArray(donations) || donations.length === 0) {
      console.warn(
        "[SSEService] Tentativa de notificar doações pagas sem dados válidos."
      );
      return;
    }

    donations.forEach((donation) => {
      // Usa a chave txid para ser consistente com o payload do webhook
      const { txid } = donation;

      const client = this.clients.get(txid);

      if (client) {
        const eventData = {
          type: "donationPaid",
          donation: {
            txid: donation.txId,
            valor: donation.amount || donation.valor,
            pagador:
              donation.donorName || donation.infoPagador || "Desconhecido",
            horario: donation.createdAt || donation.horario,
            status: donation.status,
          },
        };

        const data = `data: ${JSON.stringify(eventData)}\n\n`;

        client.res.write("event: donationPaid\n");
        client.res.write(data);
      }
    });
  }
}

const sseService = new SSEService();
export default sseService;
