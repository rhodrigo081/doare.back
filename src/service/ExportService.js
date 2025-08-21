import PDFDocument from "pdfkit"
import { createObjectCsvWriter } from "csv-writer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { DatabaseError } from "../utils/Errors.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class ExportService {
  /**
   * Generates a CSV file for donations
   * @param {Array} donations - Array of donation objects
   * @param {string} filePath - Path where the CSV file will be saved
   * @returns {Promise<string>} - Path to the generated CSV file
   */
  static async generateDonationsCSV(donations, filePath) {
    try {
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: "id", title: "ID" },
          { id: "donorName", title: "Nome do Doador" },
          { id: "donorCPF", title: "CPF" },
          { id: "donorCIM", title: "CIM" },
          { id: "amount", title: "Valor (R$)" },
          { id: "status", title: "Status" },
          { id: "txId", title: "ID da Transação" },
          { id: "createdAt", title: "Data de Criação" },
        ],
      })

      const records = donations.map((donation) => ({
        id: donation.id,
        donorName: donation.donorName,
        donorCPF: this.formatCPF(donation.donorCPF),
        donorCIM: donation.donorCIM,
        amount: `R$ ${donation.amount.toFixed(2).replace(".", ",")}`,
        status: donation.status,
        txId: donation.txId,
        createdAt: this.formatDate(donation.createdAt),
      }))

      await csvWriter.writeRecords(records)
      return filePath
    } catch (error) {
      throw new DatabaseError(`Erro ao gerar CSV de doações: ${error.message}`)
    }
  }

  /**
   * Generates a CSV file for partners
   * @param {Array} partners - Array of partner objects
   * @param {string} filePath - Path where the CSV file will be saved
   * @returns {Promise<string>} - Path to the generated CSV file
   */
  static async generatePartnersCSV(partners, filePath) {
    try {
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: "id", title: "ID" },
          { id: "name", title: "Nome" },
          { id: "cpf", title: "CPF" },
          { id: "cim", title: "CIM" },
          { id: "degree", title: "Formação" },
          { id: "profession", title: "Profissão" },
        ],
      })

      const records = partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
        cpf: this.formatCPF(partner.cpf),
        cim: partner.cim,
        degree: partner.degree,
        profession: partner.profession || "Não informado",
      }))

      await csvWriter.writeRecords(records)
      return filePath
    } catch (error) {
      throw new DatabaseError(`Erro ao gerar CSV de parceiros: ${error.message}`)
    }
  }

  /**
   * Generates a PDF file for donations
   * @param {Array} donations - Array of donation objects
   * @param {string} filePath - Path where the PDF file will be saved
   * @returns {Promise<string>} - Path to the generated PDF file
   */
  static async generateDonationsPDF(donations, filePath) {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Header
      doc.fontSize(20).text("Relatório de Doações", { align: "center" })
      doc.fontSize(12).text(`Gerado em: ${this.formatDate(new Date())}`, { align: "center" })
      doc.moveDown(2)

      // Summary
      const totalDonations = donations.length
      const totalAmount = donations.reduce((sum, donation) => sum + donation.amount, 0)
      const paidDonations = donations.filter((d) => d.status === "PAGA").length

      doc.fontSize(14).text("Resumo:", { underline: true })
      doc.fontSize(12)
      doc.text(`Total de doações: ${totalDonations}`)
      doc.text(`Doações pagas: ${paidDonations}`)
      doc.text(`Valor total: R$ ${totalAmount.toFixed(2).replace(".", ",")}`)
      doc.moveDown(2)

      // Table header
      doc.fontSize(14).text("Detalhes das Doações:", { underline: true })
      doc.moveDown(1)

      // Table
      const tableTop = doc.y
      const itemHeight = 20
      let currentY = tableTop

      // Headers
      doc.fontSize(10)
      this.drawTableRow(doc, currentY, "Nome do Doador", "CPF", "CIM", "Valor", "Status", "Data")
      currentY += itemHeight

      // Draw header line
      doc
        .moveTo(50, currentY - 5)
        .lineTo(550, currentY - 5)
        .stroke()

      // Data rows
      donations.forEach((donation, index) => {
        if (currentY > 700) {
          // New page if needed
          doc.addPage()
          currentY = 50
        }

        this.drawTableRow(
          doc,
          currentY,
          donation.donorName,
          this.formatCPF(donation.donorCPF),
          donation.donorCIM,
          `R$ ${donation.amount.toFixed(2).replace(".", ",")}`,
          donation.status,
          this.formatDate(donation.createdAt),
        )
        currentY += itemHeight
      })

      doc.end()

      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(filePath))
        stream.on("error", reject)
      })
    } catch (error) {
      throw new DatabaseError(`Erro ao gerar PDF de doações: ${error.message}`)
    }
  }

  /**
   * Generates a PDF file for partners
   * @param {Array} partners - Array of partner objects
   * @param {string} filePath - Path where the PDF file will be saved
   * @returns {Promise<string>} - Path to the generated PDF file
   */
  static async generatePartnersPDF(partners, filePath) {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Header
      doc.fontSize(20).text("Relatório de Parceiros", { align: "center" })
      doc.fontSize(12).text(`Gerado em: ${this.formatDate(new Date())}`, { align: "center" })
      doc.moveDown(2)

      // Summary
      const totalPartners = partners.length
      const degreeCount = partners.reduce((acc, partner) => {
        acc[partner.degree] = (acc[partner.degree] || 0) + 1
        return acc
      }, {})

      doc.fontSize(14).text("Resumo:", { underline: true })
      doc.fontSize(12)
      doc.text(`Total de parceiros: ${totalPartners}`)
      Object.entries(degreeCount).forEach(([degree, count]) => {
        doc.text(`${degree}: ${count}`)
      })
      doc.moveDown(2)

      // Table header
      doc.fontSize(14).text("Detalhes dos Parceiros:", { underline: true })
      doc.moveDown(1)

      // Table
      const tableTop = doc.y
      const itemHeight = 20
      let currentY = tableTop

      // Headers
      doc.fontSize(10)
      this.drawTableRow(doc, currentY, "Nome", "CPF", "CIM", "Formação", "Profissão", "")
      currentY += itemHeight

      // Draw header line
      doc
        .moveTo(50, currentY - 5)
        .lineTo(550, currentY - 5)
        .stroke()

      // Data rows
      partners.forEach((partner, index) => {
        if (currentY > 700) {
          // New page if needed
          doc.addPage()
          currentY = 50
        }

        this.drawTableRow(
          doc,
          currentY,
          partner.name,
          this.formatCPF(partner.cpf),
          partner.cim,
          partner.degree,
          partner.profession || "N/A",
          "",
        )
        currentY += itemHeight
      })

      doc.end()

      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(filePath))
        stream.on("error", reject)
      })
    } catch (error) {
      throw new DatabaseError(`Erro ao gerar PDF de parceiros: ${error.message}`)
    }
  }

  /**
   * Helper method to draw table rows in PDF
   */
  static drawTableRow(doc, y, col1, col2, col3, col4, col5, col6) {
    doc.text(col1, 50, y, { width: 80, ellipsis: true })
    doc.text(col2, 135, y, { width: 80, ellipsis: true })
    doc.text(col3, 220, y, { width: 60, ellipsis: true })
    doc.text(col4, 285, y, { width: 80, ellipsis: true })
    doc.text(col5, 370, y, { width: 80, ellipsis: true })
    doc.text(col6, 455, y, { width: 80, ellipsis: true })
  }

  /**
   * Helper method to format CPF
   */
  static formatCPF(cpf) {
    if (!cpf) return ""
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  /**
   * Helper method to format date
   */
  static formatDate(date) {
    if (!date) return ""
    const d = new Date(date)
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR")
  }

  /**
   * Creates export directory if it doesn't exist
   */
  static ensureExportDirectory() {
    const exportDir = path.join(process.cwd(), "exports")
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true })
    }
    return exportDir
  }

  /**
   * Cleans up old export files (older than 1 hour)
   */
  static cleanupOldFiles() {
    try {
      const exportDir = this.ensureExportDirectory()
      const files = fs.readdirSync(exportDir)
      const oneHourAgo = Date.now() - 60 * 60 * 1000

      files.forEach((file) => {
        const filePath = path.join(exportDir, file)
        const stats = fs.statSync(filePath)
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      console.warn("Erro ao limpar arquivos antigos:", error.message)
    }
  }
}