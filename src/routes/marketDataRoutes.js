const express = require("express")
const router = express.Router()
const marketDataController = require("../controllers/marketDataController")

// Search route - MUST come before other parameterized routes
router.get("/search", marketDataController.searchStocks)

// Stats route
router.get("/stats", marketDataController.getMarketStats)

// Latest prices route
router.get("/latest", marketDataController.getLatestPrices)

// Option chain routes - specific routes first
router.get("/options/underlyings", marketDataController.getAvailableUnderlyings)

// Existing specific routes
router.get("/options/:underlying/:expiry/:strike", marketDataController.getOptionByStrike)
router.post("/options/:underlying/fetch", marketDataController.fetchOptionChainData)
router.get("/options/:underlying/:expiry", marketDataController.getOptionsByExpiry)
router.get("/options/:underlying", marketDataController.getOptionChain)

// NEW: Comprehensive option chain with all strikes
router.get("/options/:underlying/comprehensive", marketDataController.getComprehensiveOptionChain)

// General market data routes - MUST come after specific routes
router.get("/symbol/:symbol", marketDataController.getMarketDataBySymbol)
router.post("/fetch", marketDataController.fetchFreshData)
router.get("/", marketDataController.getMarketData)

// Add the new routes only if the functions exist
try {
  if (marketDataController.getStockDetails) {
    router.get("/stock/:symbol/details", marketDataController.getStockDetails)
  }
  if (marketDataController.getStockOptionChain) {
    router.get("/stock/:symbol/options", marketDataController.getStockOptionChain)
  }
  if (marketDataController.getMarketOverview) {
    router.get("/overview", marketDataController.getMarketOverview)
  }
  if (marketDataController.getStocksWithDerivatives) {
    router.get("/derivatives", marketDataController.getStocksWithDerivatives)
  }
  if (marketDataController.getAllStocks) {
    router.get("/stocks", marketDataController.getAllStocks)
  }
  if (marketDataController.getNSEStocks) {
    router.get("/stocks/nse", marketDataController.getNSEStocks)
  }
  if (marketDataController.getBSEStocks) {
    router.get("/stocks/bse", marketDataController.getBSEStocks)
  }
  if (marketDataController.getStockMasterStats) {
    router.get("/stocks/stats", marketDataController.getStockMasterStats)
  }
  if (marketDataController.getAllOptionsForUnderlying) {
    router.get("/options/:underlying/all", marketDataController.getAllOptionsForUnderlying)
  }
} catch (error) {
  console.error("❌ Error setting up optional routes:", error.message)
}

module.exports = router
