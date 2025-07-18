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
      console.log(`📊 Lookup maps built: Tokens: ${this.stockMap.size}, Symbols: ${this.symbolMap.size}`)
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

      console.log("📊 Attempting to fetch fresh stock master data from Angel Broking API...")
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
        console.log(`✅ Received ${response.data.length} records from Angel Broking API.`)
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
      if (error.response) {
        console.error("   Status:", error.response.status)
        console.error("   Data:", error.response.data)
      }

      // If we have cached data, use it even if expired
      if (this.stockMaster.length > 0) {
        console.log("⚠️ Using expired cached data as fallback")
        return this.stockMaster
      }

      throw error
    }
  }

  buildLookupMaps() {
    console.log("📊 Starting to build lookup maps...")

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
    console.log(`🔍 Initial static search results count: ${staticResults.length}`)
    console.log(`🔍 Total instruments in stockMaster for search: ${this.stockMaster.length}`) // Added log

    // Then search through the comprehensive stock master
    for (const stock of this.stockMaster) {
      if (results.length >= limit) break

      // Skip if already included from static config
      if (staticResults.some((r) => r.token === stock.token)) {
        // console.log(`🔍 Skipping ${stock.symbol} (already in static config)`); // Debug: too verbose
        continue
      }

      // Filter by exchange
      if (!exchanges.includes(stock.exch_seg)) {
        // console.log(`🔍 Skipping ${stock.symbol} (exchange ${stock.exch_seg} not in ${exchanges.join(',')})`); // Debug: too verbose
        continue
      }

      // Filter by instrument type
      if (!instrumentTypes.includes(stock.instrumenttype)) {
        // console.log(`🔍 Skipping ${stock.symbol} (instrument type ${stock.instrumenttype} not in ${instrumentTypes.join(',')})`); // Debug: too verbose
        continue
      }

      // Skip expired instruments unless requested
      if (!includeExpired && stock.expiry && stock.expiry !== "" && new Date(stock.expiry) < new Date()) {
        // console.log(`🔍 Skipping ${stock.symbol} (expired)`); // Debug: too verbose
        continue
      }

      // Check if symbol or name matches search term
      const symbolMatch = stock.symbol && stock.symbol.toLowerCase().includes(searchTerm)
      const nameMatch = stock.name && stock.name.toLowerCase().includes(searchTerm)

      if (symbolMatch || nameMatch) {
        const formattedStock = this.formatStockResult(stock)
        results.push(formattedStock)
        console.log(
          `✅ Added stock from master to results: ${formattedStock.symbol} (Type: ${formattedStock.type}, Source: ${formattedStock.source})`,
        ) // Enhanced log
      }
    }
    console.log(`🔍 Total results before slicing: ${results.length}`)

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
    // Examples: NIFTY23NOV24000CE -> NIFTY, RELIANCE23NOV2800PE -> RELIANCE
    const match = optionSymbol.match(/^([A-Z]+)/)
    return match ? match[1] : null
  }

  // Get comprehensive stock details with price ranges
  async getStockDetails(symbol, authToken = null) {
    try {
      console.log(`📊 Getting comprehensive stock details for ${symbol}`)

      // First, find the stock in our database
      let stockInfo = this.getStockBySymbol(symbol)

      // If not found in stock master, try static config
      if (!stockInfo) {
        const { searchStocks } = require("../config/stockConfig")
        const staticResults = searchStocks(symbol)

        if (staticResults.length > 0) {
          const staticStock = staticResults[0]
          stockInfo = {
            token: staticStock.token,
            symbol: staticStock.symbol,
            name: staticStock.name,
            exch_seg: staticStock.exchange || "NSE",
            instrumenttype: "EQ",
            lotsize: 1,
          }
          console.log(`📊 Found ${symbol} in static config`)
        }
      }

      if (!stockInfo) {
        throw new Error(`Stock ${symbol} not found`)
      }

      // Basic stock information
      const stockDetails = {
        basic: {
          token: stockInfo.token,
          symbol: stockInfo.symbol,
          name: stockInfo.name || stockInfo.symbol,
          exchange: stockInfo.exch_seg,
          instrumentType: stockInfo.instrumenttype,
          lotSize: stockInfo.lotsize || 1,
          isin: stockInfo.isin || null,
        },
        priceRanges: null,
        derivatives: {
          hasFutures: false,
          hasOptions: false,
          futures: [],
          options: [],
          expiries: [],
        },
      }

      // ALWAYS try to fetch live price data if we have auth token
      if (authToken && stockInfo.token) {
        try {
          console.log(`📊 Fetching live price data for ${symbol} (token: ${stockInfo.token})`)

          // Import marketDataService here to avoid circular dependency
          const marketDataService = require("./marketDataService")
          const priceRanges = await marketDataService.getStockPriceRanges(authToken, stockInfo)
          stockDetails.priceRanges = priceRanges
          console.log(`✅ Successfully added price ranges for ${symbol}`)
        } catch (priceError) {
          console.error(`❌ Error fetching price ranges for ${symbol}:`, priceError.message)

          // Try alternative method - fetch from general market data
          try {
            console.log(`📊 Trying alternative price fetch for ${symbol}`)
            const marketDataService = require("./marketDataService")
            const result = await marketDataService.fetchMarketData(authToken, "FULL")
            const stockData = result.data?.find(
              (item) => item.symbol?.toUpperCase() === symbol.toUpperCase() || item.token === stockInfo.token,
            )

            if (stockData) {
              stockDetails.priceRanges = {
                current: {
                  ltp: Number.parseFloat((stockData.ltp || 0).toFixed(2)),
                  change: Number.parseFloat((stockData.change || 0).toFixed(2)),
                  changePercent: Number.parseFloat((stockData.changePercent || 0).toFixed(2)),
                  volume: stockData.volume || 0,
                  avgPrice: Number.parseFloat((stockData.avgPrice || 0).toFixed(2)),
                  timestamp: new Date().toISOString(),
                },
                today: {
                  open: Number.parseFloat((stockData.open || 0).toFixed(2)),
                  high: Number.parseFloat((stockData.high || 0).toFixed(2)),
                  low: Number.parseFloat((stockData.low || 0).toFixed(2)),
                  close: Number.parseFloat((stockData.close || 0).toFixed(2)),
                  volume: stockData.volume || 0,
                },
                yearly: {
                  high52Week: Number.parseFloat((stockData.weekHigh52 || 0).toFixed(2)),
                  low52Week: Number.parseFloat((stockData.weekLow52 || 0).toFixed(2)),
                  changeFrom52WeekHigh:
                    stockData.weekHigh52 > 0
                      ? Number.parseFloat(
                          (((stockData.ltp - stockData.weekHigh52) / stockData.weekHigh52) * 100).toFixed(2),
                        )
                      : 0,
                  changeFrom52WeekLow:
                    stockData.weekLow52 > 0
                      ? Number.parseFloat(
                          (((stockData.ltp - stockData.weekLow52) / stockData.weekLow52) * 100).toFixed(2),
                        )
                      : 0,
                },
                circuits: {
                  upperCircuit: Number.parseFloat((stockData.upperCircuit || 0).toFixed(2)),
                  lowerCircuit: Number.parseFloat((stockData.lowerCircuit || 0).toFixed(2)),
                },
                metadata: {
                  symbol: stockInfo.symbol,
                  token: stockInfo.token,
                  exchange: stockInfo.exch_seg,
                  instrumentType: stockInfo.instrumenttype,
                  lastUpdated: new Date().toISOString(),
                  dataSource: "angel_broking_market_data",
                },
              }

              // Calculate estimated weekly and monthly ranges
              const currentPrice = stockData.ltp || 0
              const high52Week = stockData.weekHigh52 || 0
              const low52Week = stockData.weekLow52 || 0

              if (currentPrice > 0) {
                const estimatedMonthlyHigh = Math.min(high52Week, currentPrice * 1.12)
                const estimatedMonthlyLow = Math.max(low52Week, currentPrice * 0.88)
                const estimatedWeeklyHigh = Math.min(estimatedMonthlyHigh, currentPrice * 1.05)
                const estimatedWeeklyLow = Math.max(low52Week, currentPrice * 0.95)

                stockDetails.priceRanges.weekly = {
                  high: Number.parseFloat(estimatedWeeklyHigh.toFixed(2)),
                  low: Number.parseFloat(estimatedWeeklyLow.toFixed(2)),
                  changeFromWeekHigh: Number.parseFloat(
                    (((currentPrice - estimatedWeeklyHigh) / estimatedWeeklyHigh) * 100).toFixed(2),
                  ),
                  changeFromWeekLow: Number.parseFloat(
                    (((currentPrice - estimatedWeeklyLow) / estimatedWeeklyLow) * 100).toFixed(2),
                  ),
                }

                stockDetails.priceRanges.monthly = {
                  high: Number.parseFloat(estimatedMonthlyHigh.toFixed(2)),
                  low: Number.parseFloat(estimatedMonthlyLow.toFixed(2)),
                  changeFromMonthHigh: Number.parseFloat(
                    (((currentPrice - estimatedMonthlyHigh) / estimatedMonthlyHigh) * 100).toFixed(2),
                  ),
                  changeFromMonthLow: Number.parseFloat(
                    (((currentPrice - estimatedMonthlyLow) / estimatedMonthlyLow) * 100).toFixed(2),
                  ),
                }
              }

              console.log(`✅ Successfully added price data via alternative method for ${symbol}`)
            }
          } catch (altError) {
            console.error(`❌ Alternative price fetch also failed for ${symbol}:`, altError.message)
          }
        }
      } else {
        console.log(`⚠️ No auth token available for live price data for ${symbol}`)
      }

      // Check if stock has derivatives
      const hasDerivatives = this.checkStockDerivatives(symbol)
      if (hasDerivatives) {
        stockDetails.derivatives = hasDerivatives
      }

      return stockDetails
    } catch (error) {
      console.error(`❌ Error getting stock details for ${symbol}:`, error.message)
      throw error
    }
  }

  // Check if stock has derivatives (futures/options)
  checkStockDerivatives(symbol) {
    const derivatives = {
      hasFutures: false,
      hasOptions: false,
      futures: [],
      options: [],
      expiries: [],
    }

    // Check in stock master for derivative instruments
    const futureContracts = this.stockMaster.filter(
      (stock) =>
        stock.symbol.startsWith(symbol) && (stock.instrumenttype === "FUTIDX" || stock.instrumenttype === "FUTSTK"),
    )

    const optionContracts = this.stockMaster.filter(
      (stock) =>
        stock.symbol.startsWith(symbol) && (stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK"),
    )

    if (futureContracts.length > 0) {
      derivatives.hasFutures = true
      derivatives.futures = futureContracts.map((contract) => ({
        token: contract.token,
        symbol: contract.symbol,
        expiry: contract.expiry,
        lotSize: contract.lotsize,
      }))
    }

    if (optionContracts.length > 0) {
      derivatives.hasOptions = true
      derivatives.options = optionContracts.map((contract) => ({
        token: contract.token,
        symbol: contract.symbol,
        expiry: contract.expiry,
        strike: contract.strike,
        optionType: contract.symbol.includes("CE") ? "CE" : "PE",
        lotSize: contract.lotsize,
      }))

      // Get unique expiries
      derivatives.expiries = [...new Set(optionContracts.map((c) => c.expiry).filter((e) => e))].sort()
    }

    return derivatives
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
