const express = require("express")
const router = express.Router()
const marketDataController = require("../controllers/marketDataController")

// Market Data Routes
router.get("/", marketDataController.getMarketData)
router.get("/latest", marketDataController.getLatestPrices)
router.get("/symbol/:symbol", marketDataController.getMarketDataBySymbol)
router.post("/fetch", marketDataController.fetchFreshData)
router.get("/stats", marketDataController.getMarketStats)

// Search Routes
router.get("/search", marketDataController.searchStocks)

// Stock Details Routes
router.get("/stocks/suggest/:partialSymbol", marketDataController.suggestStockSymbols) // NEW: Stock symbol suggestions
router.get("/stock/:symbol/details", marketDataController.getStockDetails)
router.get("/stocks/:symbol", marketDataController.getStockDetails)

// Option Chain Routes
router.get("/options/underlyings", marketDataController.getAvailableUnderlyings)

// NEW: Flexible option search route
router.get("/options/:underlying/search", marketDataController.searchOptionsByStrikeAndExpiry)

// NEW: Get all expiries for a specific strike
router.get("/options/:underlying/strike/:strike", marketDataController.getOptionsByStrike)

// Comprehensive option chain
router.get("/options/:underlying/comprehensive", marketDataController.getComprehensiveOptionChain)

// Basic option chain
router.get("/options/:underlying", marketDataController.getOptionChain)

// Fetch fresh option data
router.post("/options/:underlying/fetch", marketDataController.fetchOptionChainData)

// Options by expiry
router.get("/options/:underlying/:expiry", marketDataController.getOptionsByExpiry)

// Specific strike and expiry (with flexible matching)
router.get("/options/:underlying/:expiry/:strike", marketDataController.getOptionByStrike)

// NEW: Live Market Data API for Add Call functionality
router.get("/live/options", marketDataController.getLiveOptionsData)
router.post("/live/add-call", marketDataController.addCallPosition)
router.get("/live/instruments/:segment", marketDataController.getInstrumentsBySegment)
router.get("/live/scripts/:instrument", marketDataController.getScriptsByInstrument)
router.get("/live/expiries/:script", marketDataController.getExpiriesByScript)
router.get("/live/strikes/:script/:expiry", marketDataController.getStrikesByScriptAndExpiry)

// NEW: Major Indices Route
router.get("/indices/major", marketDataController.getMajorIndices)

// NEW: Debug endpoint
router.get("/debug", marketDataController.debugMarketData)

module.exports = router
