const express = require("express")
const cors = require("cors")
const http = require("http")
require("dotenv").config()

// Import services and configurations
const { connectDatabase } = require("./src/config/database")
const { initializeWebSocketServer } = require("./src/services/websocketService")
const { startMarketDataScheduler } = require("./src/services/schedulerService")
const { startMarketBroadcastLoop } = require("./liveMarketStreamer")
const { setupRoutes } = require("./src/routes")
const { errorHandler } = require("./src/middleware/errorHandler")
const { requestLogger } = require("./src/middleware/logger")
const stockMasterService = require("./src/services/stockMasterService")

// Initialize Express app
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(requestLogger)

// Connect to database
connectDatabase()

// Initialize Stock Master Service
stockMasterService.initialize().catch((error) => {
  console.error("❌ Failed to initialize Stock Master Service:", error.message)
  console.log("⚠️ Continuing with static stock configuration only")
})

// Setup routes BEFORE error handler
setupRoutes(app)

// Add a catch-all route for debugging
app.use("*", (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "GET /api/market-data/search?q=NIFTY",
      "GET /api/market-data/options/NIFTY",
      "POST /api/market-data/options/NIFTY/fetch",
      "GET /api/auth/status",
      "POST /api/auth/login",
    ],
  })
})

// Error handling middleware (MUST be last)
app.use(errorHandler)

// Initialize WebSocket server
initializeWebSocketServer(server)

// Start market data scheduler
startMarketDataScheduler()

// Start server
server.listen(PORT, () => {
  console.log("🚀 Angel Broking Backend Server Started")
  console.log(`📡 Server running on port ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`)
  console.log("📊 Real-time market data service active")

  // Environment check
  console.log("\n🔧 Configuration Check:")
  console.log(`   CLIENT_CODE: ${process.env.CLIENT_CODE ? "✅ Set" : "❌ Missing"}`)
  console.log(`   MPIN: ${process.env.MPIN ? "✅ Set" : "❌ Missing"}`)
  console.log(`   SMARTAPI_KEY: ${process.env.SMARTAPI_KEY ? "✅ Set" : "❌ Missing"}`)
  console.log(`   TOTP_SECRET: ${process.env.TOTP_SECRET ? "✅ Set" : "❌ Missing"}`)
  console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? "✅ Set" : "❌ Missing"}`)

  console.log("\n📋 Available API Endpoints:")
  console.log("   🔍 Search: GET /api/market-data/search?q=NIFTY")
  console.log("   📊 Option Chain: GET /api/market-data/options/NIFTY")
  console.log("   🔄 Fetch Options: POST /api/market-data/options/NIFTY/fetch")
  console.log("   🔐 Auth Status: GET /api/auth/status")
  console.log("   🔑 Login: POST /api/auth/login")
  console.log("   📈 Stock Master: GET /api/market-data/stocks")

  startMarketBroadcastLoop()
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully")
  server.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})
