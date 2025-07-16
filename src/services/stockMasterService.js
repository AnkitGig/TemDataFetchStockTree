const axios = require("axios")
const { STOCK_CONFIG } = require("../config/stockConfig")

class StockMasterService {
  constructor() {
    this.stockMaster = []
    this.stockMap = new Map() // For quick token lookup
    this.symbolMap = new Map() // For quick symbol lookup
    this.lastFetchTime = null
    this.cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours
    this.isLoading = false
  }

  async initialize() {
    if (this.isLoading) {
      console.log("📊 Stock master already loading...")
      return
    }

    try {
      this.isLoading = true
      console.log("📊 Initializing Stock Master Service...")

      await this.fetchStockMaster()
      console.log(`✅ Stock Master initialized with ${this.stockMaster.length} instruments`)
    } catch (error) {
      console.error("❌ Error initializing Stock Master:", error.message)
    } finally {
      this.isLoading = false
    }
  }

  async fetchStockMaster() {
    try {
      // Check if we have cached data that's still valid
      if (this.stockMaster.length > 0 && this.lastFetchTime) {
        const timeSinceLastFetch = Date.now() - this.lastFetchTime.getTime()
        if (timeSinceLastFetch < this.cacheExpiry) {
          console.log("📊 Using cached stock master data")
          return this.stockMaster
        }
      }

      console.log("📊 Fetching fresh stock master data from Angel Broking...")

      const response = await axios.get(
        "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
        {
          timeout: 30000, // 30 second timeout
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        },
      )

      if (response.data && Array.isArray(response.data)) {
        this.stockMaster = response.data
        this.lastFetchTime = new Date()

        // Build lookup maps for performance
        this.buildLookupMaps()

        console.log(`✅ Fetched ${this.stockMaster.length} instruments from Angel Broking`)
        console.log(`📊 Breakdown:`)
        console.log(`   NSE Equity: ${this.getEquityCount("NSE")}`)
        console.log(`   BSE Equity: ${this.getEquityCount("BSE")}`)
        console.log(`   NFO Options: ${this.getOptionsCount("NFO")}`)
        console.log(`   NFO Futures: ${this.getFuturesCount("NFO")}`)

        return this.stockMaster
      } else {
        throw new Error("Invalid response format from Angel Broking API")
      }
    } catch (error) {
      console.error("❌ Error fetching stock master:", error.message)

      // If we have cached data, use it even if expired
      if (this.stockMaster.length > 0) {
        console.log("⚠️ Using expired cached data as fallback")
        return this.stockMaster
      }

      throw error
    }
  }

  buildLookupMaps() {
    console.log("📊 Building lookup maps...")

    this.stockMap.clear()
    this.symbolMap.clear()

    this.stockMaster.forEach((stock) => {
      // Token lookup
      this.stockMap.set(stock.token, stock)

      // Symbol lookup (handle duplicates by preferring NSE over BSE)
      const existingStock = this.symbolMap.get(stock.symbol)
      if (!existingStock || (stock.exch_seg === "NSE" && existingStock.exch_seg === "BSE")) {
        this.symbolMap.set(stock.symbol, stock)
      }
    })

    console.log(`📊 Built lookup maps: ${this.stockMap.size} tokens, ${this.symbolMap.size} symbols`)
  }

  // Get stock by token
  getStockByToken(token) {
    return this.stockMap.get(token) || null
  }

  // Get stock by symbol
  getStockBySymbol(symbol) {
    return this.symbolMap.get(symbol.toUpperCase()) || null
  }

  // Search stocks with comprehensive filtering
  searchStocks(query, options = {}) {
    if (!query || query.length < 2) return []

    const {
      limit = 50,
      exchanges = ["NSE", "BSE", "NFO"],
      instrumentTypes = ["EQ", "OPTIDX", "OPTSTK", "FUTIDX", "FUTSTK"],
      includeExpired = false,
    } = options

    const searchTerm = query.toLowerCase()
    const results = []

    // First, add results from existing static config (these are prioritized)
    const staticResults = this.searchStaticConfig(query)
    results.push(...staticResults)

    // Then search through the comprehensive stock master
    for (const stock of this.stockMaster) {
      if (results.length >= limit) break

      // Skip if already included from static config
      if (staticResults.some((r) => r.token === stock.token)) continue

      // Filter by exchange
      if (!exchanges.includes(stock.exch_seg)) continue

      // Filter by instrument type
      if (!instrumentTypes.includes(stock.instrumenttype)) continue

      // Skip expired instruments unless requested
      if (!includeExpired && stock.expiry && stock.expiry !== "" && new Date(stock.expiry) < new Date()) {
        continue
      }

      // Check if symbol or name matches search term
      const symbolMatch = stock.symbol && stock.symbol.toLowerCase().includes(searchTerm)
      const nameMatch = stock.name && stock.name.toLowerCase().includes(searchTerm)

      if (symbolMatch || nameMatch) {
        results.push(this.formatStockResult(stock))
      }
    }

    return results.slice(0, limit)
  }

  searchStaticConfig(query) {
    const searchTerm = query.toLowerCase()
    const results = []

    // Search NSE stocks
    STOCK_CONFIG.NSE.forEach((stock) => {
      if (stock.symbol.toLowerCase().includes(searchTerm) || stock.name.toLowerCase().includes(searchTerm)) {
        results.push({
          ...stock,
          type: "EQUITY",
          exchange: "NSE",
          source: "static_config",
        })
      }
    })

    // Search Option Underlyings
    Object.keys(STOCK_CONFIG.OPTION_UNDERLYINGS).forEach((symbol) => {
      const underlying = STOCK_CONFIG.OPTION_UNDERLYINGS[symbol]

      if (symbol.toLowerCase().includes(searchTerm) || underlying.name.toLowerCase().includes(searchTerm)) {
        results.push({
          token: underlying.token,
          symbol: symbol,
          name: underlying.name,
          type: "OPTION_CHAIN",
          exchange: underlying.exchange,
          lotSize: underlying.lotSize,
          source: "static_config",
        })
      }
    })

    return results
  }

  formatStockResult(stock) {
    let type = "EQUITY"

    // Determine type based on instrument type
    switch (stock.instrumenttype) {
      case "OPTIDX":
      case "OPTSTK":
        type = "OPTION"
        break
      case "FUTIDX":
      case "FUTSTK":
        type = "FUTURE"
        break
      case "EQ":
        type = "EQUITY"
        break
      default:
        type = stock.instrumenttype
    }

    // Check if this is an option chain underlying
    const isOptionUnderlying = Object.keys(STOCK_CONFIG.OPTION_UNDERLYINGS).includes(stock.symbol)

    if (isOptionUnderlying) {
      type = "OPTION_CHAIN"
    }

    return {
      token: stock.token,
      symbol: stock.symbol,
      name: stock.name || stock.symbol,
      type: type,
      exchange: stock.exch_seg,
      instrumentType: stock.instrumenttype,
      lotSize: stock.lotsize || 1,
      expiry: stock.expiry || null,
      strike: stock.strike || null,
      source: "angel_api",
    }
  }

  // Get all equity stocks for a specific exchange
  getEquityStocks(exchange = "NSE", limit = 1000) {
    return this.stockMaster
      .filter((stock) => stock.exch_seg === exchange && stock.instrumenttype === "EQ")
      .slice(0, limit)
      .map((stock) => this.formatStockResult(stock))
  }

  // Get all option underlyings
  getOptionUnderlyings() {
    const underlyings = []

    // Add from static config first
    Object.keys(STOCK_CONFIG.OPTION_UNDERLYINGS).forEach((symbol) => {
      const underlying = STOCK_CONFIG.OPTION_UNDERLYINGS[symbol]
      underlyings.push({
        symbol,
        ...underlying,
        type: "OPTION_UNDERLYING",
        source: "static_config",
      })
    })

    // Add any additional option underlyings found in stock master
    const optionSymbols = new Set()
    this.stockMaster
      .filter((stock) => stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK")
      .forEach((stock) => {
        // Extract underlying symbol from option symbol
        const underlyingSymbol = this.extractUnderlyingFromOption(stock.symbol)
        if (underlyingSymbol && !optionSymbols.has(underlyingSymbol)) {
          optionSymbols.add(underlyingSymbol)

          // Check if not already in static config
          if (!STOCK_CONFIG.OPTION_UNDERLYINGS[underlyingSymbol]) {
            underlyings.push({
              symbol: underlyingSymbol,
              token: stock.token, // This might not be the underlying token
              name: underlyingSymbol,
              type: "OPTION_UNDERLYING",
              exchange: stock.exch_seg,
              lotSize: stock.lotsize || 1,
              source: "discovered",
            })
          }
        }
      })

    return underlyings
  }

  extractUnderlyingFromOption(optionSymbol) {
    // Extract underlying symbol from option symbol
    // Examples: NIFTY23NOV24000CE -> NIFTY, RELIANCE23NOV2800PE -> RELIANCE
    const match = optionSymbol.match(/^([A-Z]+)/)
    return match ? match[1] : null
  }

  // Helper methods for statistics
  getEquityCount(exchange) {
    return this.stockMaster.filter((stock) => stock.exch_seg === exchange && stock.instrumenttype === "EQ").length
  }

  getOptionsCount(exchange) {
    return this.stockMaster.filter(
      (stock) =>
        stock.exch_seg === exchange && (stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK"),
    ).length
  }

  getFuturesCount(exchange) {
    return this.stockMaster.filter(
      (stock) =>
        stock.exch_seg === exchange && (stock.instrumenttype === "FUTIDX" || stock.instrumenttype === "FUTSTK"),
    ).length
  }

  // Get tokens for market data fetching
  getTokensByExchange(exchange = "NSE", instrumentType = "EQ", limit = 100) {
    return this.stockMaster
      .filter((stock) => stock.exch_seg === exchange && stock.instrumenttype === instrumentType)
      .slice(0, limit)
      .map((stock) => stock.token)
  }

  // Get comprehensive token list for market data
  getMarketDataTokens() {
    const tokens = {
      NSE: [],
      BSE: [],
      NFO: [],
    }

    // Add static config tokens first (these are prioritized)
    tokens.NSE = STOCK_CONFIG.NSE.map((stock) => stock.token)
    tokens.NFO = STOCK_CONFIG.NFO.map((stock) => stock.token)

    // Add additional popular stocks from stock master
    const popularNSE = this.stockMaster
      .filter((stock) => stock.exch_seg === "NSE" && stock.instrumenttype === "EQ" && !tokens.NSE.includes(stock.token))
      .slice(0, 50) // Limit to avoid API limits
      .map((stock) => stock.token)

    tokens.NSE.push(...popularNSE)

    return tokens
  }

  getStats() {
    return {
      totalInstruments: this.stockMaster.length,
      lastFetchTime: this.lastFetchTime,
      cacheExpiry: this.cacheExpiry,
      exchanges: {
        NSE: this.getEquityCount("NSE"),
        BSE: this.getEquityCount("BSE"),
        NFO_OPTIONS: this.getOptionsCount("NFO"),
        NFO_FUTURES: this.getFuturesCount("NFO"),
      },
      isLoading: this.isLoading,
    }
  }
}

module.exports = new StockMasterService()
