import admin from "../config/db.js";
const db = admin.firestore();
import { DatabaseError } from "../utils/Errors.js";

export default class Donation {
  constructor({
    id,
    donorCPF,
    donorName,
    donorCIM,
    amount,
    txId,
    locId,
    qrCode,
    copyPaste,
    status,
    createdAt,
  }) {
    this.id = id;
    this.donorCPF = donorCPF;
    this.donorName = donorName;
    this.donorCIM = donorCIM;
    this.amount = parseFloat(amount);
    this.txId = txId;
    this.locId = locId;
    this.qrCode = qrCode;
    this.copyPaste = copyPaste;
    this.status = status;
    this.createdAt = this.convertToDate(createdAt);
  }

  convertToDate(timestamp) {
    if (
      timestamp &&
      typeof timestamp._seconds === "number" &&
      typeof timestamp._nanoseconds === "number"
    ) {
      return new Date(
        timestamp._seconds * 1000 + timestamp._nanoseconds / 1_000_000
      );
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
  }

  async save() {
    const dataToSave = {
      donorCPF: this.donorCPF,
      donorName: this.donorName,
      donorCIM: this.donorCIM,
      amount: this.amount,
      txId: this.txId,
      locId: this.locId,
      qrCode: this.qrCode,
      copyPaste: this.copyPaste,
      status: this.status,
      createdAt:
        this.createdAt instanceof Date
          ? admin.firestore.Timestamp.fromDate(this.createdAt)
          : this.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    };

    let docRef;
    try {
      if (this.id) {
        docRef = db.collection("donations").doc(this.id);
        await docRef.set(dataToSave, { merge: true });
      } else {
        dataToSave.createdAt = admin.firestore.FieldValue.serverTimestamp();
        docRef = await db.collection("donations").add(dataToSave);
        this.id = docRef.id;
      }
      return { id: this.id, ...dataToSave };
    } catch (error) {
      throw new DatabaseError(`Erro ao salvar a doação: ${error.message}`); // Adicionei .message aqui
    }
  }
}
