import express from "express"
import { authenticateToken } from "../middleware/auth.js"
import { ExportService } from "../service/ExportService.js"
import DonationService from "../service/DonationService.js"
import { PartnerService } from "../service/PartnerService.js"
import path from "path"
import fs from "fs"

const router = express.Router()

// Export donations as CSV
router.get("/donations/csv", authenticateToken, async (req, res, next) => {
  try {
    const { startDate, endDate, search } = req.query
    let donations = []

    // Get donations based on filters
    if (search) {
      const result = await DonationService.searchDonations(search, 1, 10000)
      donations = result.donations
    } else if (startDate && endDate) {
      const result = await DonationService.getDonationsByDateRange(startDate, endDate, 1, 10000)
      donations = result.donations
    } else {
      const result = await DonationService.allDonations(1, 10000)
      donations = result.donations
    }

    // Create export directory
    const exportDir = ExportService.ensureExportDirectory()
    const fileName = `donations_${Date.now()}.csv`
    const filePath = path.join(exportDir, fileName)

    // Generate CSV
    await ExportService.generateDonationsCSV(donations, filePath)

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Erro ao enviar arquivo:", err)
        return res.status(500).json({ error: "Erro ao baixar arquivo" })
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }, 5000)
    })
  } catch (error) {
    next(error)
  }
})

// Export donations as PDF
router.get("/doacoes/pdf", authenticateToken, async (req, res, next) => {
  try {
    const { startDate, endDate, search } = req.query
    let donations = []

    // Get donations based on filters
    if (search) {
      const result = await DonationService.searchDonations(search, 1, 10000)
      donations = result.donations
    } else if (startDate && endDate) {
      const result = await DonationService.getDonationsByDateRange(startDate, endDate, 1, 10000)
      donations = result.donations
    } else {
      const result = await DonationService.allDonations(1, 10000)
      donations = result.donations
    }

    // Create export directory
    const exportDir = ExportService.ensureExportDirectory()
    const fileName = `donations_${Date.now()}.pdf`
    const filePath = path.join(exportDir, fileName)

    // Generate PDF
    await ExportService.generateDonationsPDF(donations, filePath)

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Erro ao enviar arquivo:", err)
        return res.status(500).json({ error: "Erro ao baixar arquivo" })
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }, 5000)
    })
  } catch (error) {
    next(error)
  }
})

// Export partners as CSV
router.get("/partners/csv", authenticateToken, async (req, res, next) => {
  try {
    const { search } = req.query
    let partners = []

    // Get partners based on filters
    if (search) {
      const result = await PartnerService.searchPartners(search, 1, 10000)
      partners = result.partners
    } else {
      const result = await PartnerService.allpartners(1, 10000)
      partners = result.partners
    }

    // Create export directory
    const exportDir = ExportService.ensureExportDirectory()
    const fileName = `partners_${Date.now()}.csv`
    const filePath = path.join(exportDir, fileName)

    // Generate CSV
    await ExportService.generatePartnersCSV(partners, filePath)

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Erro ao enviar arquivo:", err)
        return res.status(500).json({ error: "Erro ao baixar arquivo" })
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }, 5000)
    })
  } catch (error) {
    next(error)
  }
})

// Export partners as PDF
router.get("/doadores/pdf", authenticateToken, async (req, res, next) => {
  try {
    const { search } = req.query
    let partners = []

    // Get partners based on filters
    if (search) {
      const result = await PartnerService.searchPartners(search, 1, 10000)
      partners = result.partners
    } else {
      const result = await PartnerService.allpartners(1, 10000)
      partners = result.partners
    }

    // Create export directory
    const exportDir = ExportService.ensureExportDirectory()
    const fileName = `partners_${Date.now()}.pdf`
    const filePath = path.join(exportDir, fileName)

    // Generate PDF
    await ExportService.generatePartnersPDF(partners, filePath)

    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Erro ao enviar arquivo:", err)
        return res.status(500).json({ error: "Erro ao baixar arquivo" })
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }, 5000)
    })
  } catch (error) {
    next(error)
  }
})

// Cleanup old files endpoint (optional - for maintenance)
router.post("/cleanup", authenticateToken, async (req, res) => {
  try {
    ExportService.cleanupOldFiles()
    res.json({ message: "Arquivos antigos removidos com sucesso" })
  } catch (error) {
    res.status(500).json({ error: "Erro ao limpar arquivos antigos" })
  }
})

export default router;
