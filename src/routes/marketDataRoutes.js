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

// Add these routes after the existing ones

// Market overview with live data
router.get("/overview", async (req, res) => {
  try {
    const { limit = 50, includeDerivatives = false } = req.query
    const authToken = require("../services/authService").getAuthToken()

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for market overview",
        loginEndpoint: "/api/auth/login",
      })
    }

    // Get popular stocks from stock master
    const stockMasterService = require("../services/stockMasterService")
    const popularStocks = stockMasterService.getEquityStocks("NSE", Number.parseInt(limit))

    const stocksWithLiveData = []

    // Fetch live data for each stock
    for (const stock of popularStocks.slice(0, Number.parseInt(limit))) {
      try {
        const stockDetails = await stockMasterService.getStockDetails(stock.symbol, authToken)

        // Add derivatives info if requested
        if (includeDerivatives === "true") {
          stockDetails.derivatives = stockMasterService.checkStockDerivatives(stock.symbol)
        }

        stocksWithLiveData.push({
          ...stock,
          liveData: stockDetails.priceRanges?.current,
          priceRanges: stockDetails.priceRanges,
          derivatives: includeDerivatives === "true" ? stockDetails.derivatives : undefined,
        })
      } catch (error) {
        console.error(`❌ Error fetching data for ${stock.symbol}:`, error.message)
        // Add stock without live data
        stocksWithLiveData.push(stock)
      }
    }

    res.json({
      success: true,
      data: stocksWithLiveData,
      count: stocksWithLiveData.length,
      hasLiveData: true,
      includeDerivatives: includeDerivatives === "true",
      timestamp: new Date().toISOString(),
      source: "market_overview_with_live_data",
    })
  } catch (error) {
    console.error("❌ Market overview error:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// Stocks with derivatives
router.get("/derivatives", async (req, res) => {
  try {
    const { limit = 30 } = req.query
    const authToken = require("../services/authService").getAuthToken()

    const stockMasterService = require("../services/stockMasterService")

    // Get stocks that have derivatives
    const stocksWithDerivatives = []
    const allStocks = stockMasterService.getEquityStocks("NSE", 200)

    for (const stock of allStocks) {
      const derivatives = stockMasterService.checkStockDerivatives(stock.symbol)
      if (derivatives.hasFutures || derivatives.hasOptions) {
        stocksWithDerivatives.push({
          ...stock,
          derivatives: {
            ...derivatives,
            futuresCount: derivatives.futures.length,
            optionsCount: derivatives.options.length,
          },
        })

        if (stocksWithDerivatives.length >= Number.parseInt(limit)) break
      }
    }

    res.json({
      success: true,
      data: stocksWithDerivatives,
      count: stocksWithDerivatives.length,
      timestamp: new Date().toISOString(),
      source: "stocks_with_derivatives",
    })
  } catch (error) {
    console.error("❌ Derivatives stocks error:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// Get all stocks from stock master
router.get("/stocks", async (req, res) => {
  try {
    const { exchange = "NSE", limit = 100 } = req.query
    const stockMasterService = require("../services/stockMasterService")

    const stocks = stockMasterService.getEquityStocks(exchange.toUpperCase(), Number.parseInt(limit))

    res.json({
      success: true,
      data: stocks,
      count: stocks.length,
      exchange: exchange.toUpperCase(),
      limit: Number.parseInt(limit),
      timestamp: new Date().toISOString(),
      source: "stock_master_service",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// Stock master statistics
router.get("/stocks/stats", async (req, res) => {
  try {
    const stockMasterService = require("../services/stockMasterService")
    const stats = stockMasterService.getStats()

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString(),
      source: "stock_master_service",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

module.exports = router
