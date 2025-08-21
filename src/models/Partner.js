import admin from "../config/db.js";
const db = admin.firestore();
import { DatabaseError } from "../utils/Errors.js";

export default class Partner {
  constructor({
    id,
    cpf,
    name,
    cim,
    degree,
    profession,
    dateOfBirth,
    createdAt,
  }) {
    this.id = id;
    this.cpf = cpf;
    this.name = name;
    this.cim = cim;
    this.degree = degree;
    this.profession = profession;
    this.dateOfBirth = dateOfBirth;
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
  }

  async save() {
    const dataToSave = {
      cpf: this.cpf,
      name: this.name,
      cim: this.cim,
      degree: this.degree,
      profession: this.profession,
      dateOfBirth: this.dateOfBirth,
      createdAt:
        this.createdAt instanceof Date
          ? admin.firestore.Timestamp.fromDate(this.createdAt)
          : this.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    };

    let docRef;

    try {
      if (this.id) {
        docRef = db.collection("partners").doc(this.id);
        await docRef.set(dataToSave, { merge: true });
      } else {
        docRef = await db.collection("partners").add(dataToSave);
        this.id = docRef.id;
      }
      return { id: this.id, ...dataToSave };
    } catch (error) {
      throw new DatabaseError(`Erro ao salvar parceiro: ${error}`);
    }
  }
}
