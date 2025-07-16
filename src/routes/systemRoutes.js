const express = require("express")
const router = express.Router()
const systemController = require("../controllers/systemController")

// GET /api/system/status - Get system status
router.get("/status", systemController.getSystemStatus)

// GET /api/system/health - Health check
router.get("/health", systemController.getHealthCheck)

module.exports = router
