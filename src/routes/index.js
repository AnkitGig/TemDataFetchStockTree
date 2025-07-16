const marketDataRoutes = require("./marketDataRoutes")
const authRoutes = require("./authRoutes")
const systemRoutes = require("./systemRoutes")

const setupRoutes = (app) => {
  // API routes with proper prefixes
  app.use("/api/market-data", marketDataRoutes)
  app.use("/api/auth", authRoutes)
  app.use("/api/system", systemRoutes)

  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      message: "Angel Broking Real-Time Market Data API",
      version: "1.0.0",
      endpoints: {
        search: "/api/market-data/search?q=NIFTY",
        marketData: "/api/market-data",
        optionChain: "/api/market-data/options/NIFTY",
        fetchOptionChain: "/api/market-data/options/NIFTY/fetch",
        authentication: "/api/auth",
        system: "/api/system",
        websocket: "/ws",
      },
      documentation: "https://github.com/your-repo/angel-broking-backend",
    })
  })

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  })

  console.log("📋 API routes configured successfully")
  console.log("   🔍 Search: GET /api/market-data/search?q=NIFTY")
  console.log("   📊 Option Chain: GET /api/market-data/options/NIFTY")
  console.log("   🔄 Fetch Options: POST /api/market-data/options/NIFTY/fetch")
}

module.exports = {
  setupRoutes,
}
