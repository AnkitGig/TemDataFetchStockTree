const marketDataService = require("../services/marketDataService")
const optionChainService = require("../services/optionChainService")
const authService = require("../services/authService")

const getMarketData = async (req, res) => {
  try {
    // Return live market data without database dependency
    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live market data",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()
    const result = await marketDataService.fetchMarketData(authToken, "FULL")

    res.json({
      success: true,
      data: result.data || [],
      count: result.data?.length || 0,
      fetchTime: result.fetchTime,
      source: "live_api",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getLatestPrices = async (req, res) => {
  try {
    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live prices",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()
    const result = await marketDataService.fetchMarketData(authToken, "LTP")

    res.json({
      success: true,
      data: result.data || [],
      count: result.data?.length || 0,
      fetchTime: result.fetchTime,
      source: "live_api",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getMarketDataBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live market data",
        loginEndpoint: "/api/auth/login",
      })
    }

    // For live data, we'll need to fetch all data and filter
    const authToken = authService.getAuthToken()
    const result = await marketDataService.fetchMarketData(authToken, "FULL")

    const symbolData = result.data?.filter((item) => item.symbol?.toUpperCase() === symbol.toUpperCase()) || []

    res.json({
      success: true,
      data: symbolData,
      symbol: symbol,
      count: symbolData.length,
      fetchTime: result.fetchTime,
      source: "live_api",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const fetchFreshData = async (req, res) => {
  try {
    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please login first.",
      })
    }

    const authToken = authService.getAuthToken()
    const mode = req.query.mode || "FULL"

    const result = await marketDataService.fetchMarketData(authToken, mode)

    res.json({
      success: true,
      message: "Live market data fetched successfully",
      fetchTime: result.fetchTime,
      recordCount: result.data?.length || 0,
      mode: mode,
      source: "live_api",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getMarketStats = async (req, res) => {
  try {
    const serviceStats = marketDataService.getStats()
    const optionStats = optionChainService.getStats()

    res.json({
      success: true,
      stats: {
        marketData: serviceStats,
        optionChain: optionStats,
        dataSource: "live_api_only",
        cacheEnabled: true,
        databaseStorage: false,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const searchStocks = async (req, res) => {
  try {
    console.log("🔍 Enhanced search request received:", req.query)

    const { q, exchange, type, limit = 20 } = req.query

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: [],
        message: "Query too short. Minimum 2 characters required.",
        query: q || "",
      })
    }

    console.log(`🔍 Searching for: "${q}" with filters - exchange: ${exchange}, type: ${type}`)

    // Get auth token for live search
    const authToken = authService.getAuthToken()
    console.log(`🔐 Auth token available: ${!!authToken}`)

    // Use enhanced search from stock master service
    const stockMasterService = require("../services/stockMasterService")

    const searchOptions = {
      limit: Number.parseInt(limit),
      exchanges: exchange ? [exchange.toUpperCase()] : ["NSE", "BSE", "NFO"],
      instrumentTypes: type ? [type.toUpperCase()] : ["EQ", "OPTIDX", "OPTSTK", "FUTIDX", "FUTSTK"],
    }

    const results = stockMasterService.searchStocks(q, searchOptions)

    // Also search for option chains if authenticated
    const optionResults = await optionChainService.searchOptions(q, authToken)

    // Merge and deduplicate results
    const allResults = [...results, ...optionResults]
    const uniqueResults = allResults.filter(
      (result, index, self) => index === self.findIndex((r) => r.token === result.token),
    )

    console.log(`✅ Enhanced search results found: ${uniqueResults.length}`)

    res.json({
      success: true,
      data: uniqueResults.slice(0, Number.parseInt(limit)),
      query: q,
      count: uniqueResults.length,
      filters: searchOptions,
      hasLiveData: !!authToken,
      timestamp: new Date().toISOString(),
      source: "enhanced_comprehensive_search",
    })
  } catch (error) {
    console.error("❌ Enhanced search error:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      query: req.query.q || "",
    })
  }
}

// Option Chain Endpoints - All Live Data
const getOptionChain = async (req, res) => {
  try {
    const { underlying } = req.params
    const { expiry } = req.query

    // First check cache
    const optionChain = await optionChainService.getOptionChainByUnderlying(underlying, expiry)

    if (optionChain.length === 0) {
      // No cached data, need to fetch fresh
      if (!authService.isAuthenticated()) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for live option chain data",
          loginEndpoint: "/api/auth/login",
          suggestion: `Use POST /api/market-data/options/${underlying}/fetch to get fresh data`,
        })
      }

      // Auto-fetch if authenticated
      const authToken = authService.getAuthToken()
      const result = await optionChainService.fetchOptionChainData(authToken, underlying)

      if (result.success) {
        const freshData = await optionChainService.getOptionChainByUnderlying(underlying, expiry)
        return res.json({
          success: true,
          data: freshData,
          underlying: underlying.toUpperCase(),
          expiry: expiry || "all",
          count: freshData.length,
          source: "live_api",
          fetchTime: result.fetchTime,
        })
      }
    }

    res.json({
      success: true,
      data: optionChain,
      underlying: underlying.toUpperCase(),
      expiry: expiry || "all",
      count: optionChain.length,
      source: optionChain.length > 0 ? "cache" : "no_data",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const fetchOptionChainData = async (req, res) => {
  try {
    console.log("📊 Option chain fetch request:", req.params)

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please login first.",
        loginEndpoint: "/api/auth/login",
      })
    }

    const { underlying } = req.params
    const authToken = authService.getAuthToken()

    console.log(`📊 Fetching live option chain for: ${underlying}`)

    const result = await optionChainService.fetchOptionChainData(authToken, underlying)

    res.json({
      success: true,
      message: `Live option chain data fetched for ${underlying}`,
      underlying: underlying,
      fetchTime: result.fetchTime,
      recordCount: result.data?.length || 0,
      source: result.source || "live_api",
      dataStorage: "memory_cache_only",
    })
  } catch (error) {
    console.error("❌ Option chain fetch error:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      underlying: req.params.underlying,
    })
  }
}

const getOptionsByExpiry = async (req, res) => {
  try {
    const { underlying, expiry } = req.params

    const options = await optionChainService.getOptionsByExpiry(underlying, expiry)

    res.json({
      success: true,
      data: options,
      underlying: underlying.toUpperCase(),
      expiry: expiry,
      count: options.length,
      source: options.length > 0 ? "cache" : "no_data",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Get specific strike price data
const getOptionByStrike = async (req, res) => {
  try {
    const { underlying, strike, expiry } = req.params
    const strikePrice = Number.parseInt(strike)

    console.log(`📊 Getting option data for ${underlying} strike ${strikePrice} expiry ${expiry}`)

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live option data",
        loginEndpoint: "/api/auth/login",
      })
    }

    // Get live option chain data
    const authToken = authService.getAuthToken()

    // First try to get from cache
    let optionData = await optionChainService.getOptionsByExpiry(underlying, expiry)

    // If no cached data, fetch fresh
    if (optionData.length === 0) {
      console.log(`📊 No cached data, fetching fresh option chain for ${underlying}`)
      const result = await optionChainService.fetchOptionChainData(authToken, underlying)
      if (result.success) {
        optionData = await optionChainService.getOptionsByExpiry(underlying, expiry)
      }
    }

    // Filter for specific strike price
    const callOption = optionData.find((option) => option.strike === strikePrice && option.optionType === "CE")
    const putOption = optionData.find((option) => option.strike === strikePrice && option.optionType === "PE")

    if (!callOption && !putOption) {
      return res.status(404).json({
        success: false,
        message: `No option data found for ${underlying} strike ${strikePrice} expiry ${expiry}`,
        strikePrice: strikePrice,
        expiryDate: expiry,
        underlying: underlying.toUpperCase(),
      })
    }

    // Format response as requested
    const response = {
      strikePrice: strikePrice,
      expiryDate: expiry,
      underlying: underlying.toUpperCase(),
      fetchTime: new Date().toISOString(),
      source: "live_api",
    }

    if (callOption) {
      response.callOption = {
        symbol: callOption.symbol,
        lastTradedPrice: callOption.ltp || 0,
        price: callOption.price || 0,
        openInterest: callOption.openInterest || 0,
        changeInOI: callOption.changeInOI || 0,
        volume: callOption.volume || 0,
        change: callOption.change || 0,
        changePercent: callOption.changePercent || 0,
        high: callOption.high || 0,
        low: callOption.low || 0,
        impliedVolatility: callOption.impliedVolatility || 0,
      }
    }

    if (putOption) {
      response.putOption = {
        symbol: putOption.symbol,
        lastTradedPrice: putOption.ltp || 0,
        price: putOption.price || 0,
        openInterest: putOption.openInterest || 0,
        changeInOI: putOption.changeInOI || 0,
        volume: putOption.volume || 0,
        change: putOption.change || 0,
        changePercent: putOption.changePercent || 0,
        high: putOption.high || 0,
        low: putOption.low || 0,
        impliedVolatility: putOption.impliedVolatility || 0,
      }
    }

    res.json(response)
  } catch (error) {
    console.error("❌ Error getting option by strike:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      strikePrice: req.params.strike,
      expiryDate: req.params.expiry,
      underlying: req.params.underlying,
    })
  }
}

const getAvailableUnderlyings = async (req, res) => {
  try {
    const { getOptionUnderlyings } = require("../config/stockConfig")
    const underlyings = getOptionUnderlyings()

    res.json({
      success: true,
      data: underlyings,
      count: underlyings.length,
      source: "configuration",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Enhanced stock details function with comprehensive option chain
const getStockDetails = async (req, res) => {
  try {
    const { symbol } = req.params
    const authToken = authService.getAuthToken()

    console.log(`📊 Getting comprehensive details for ${symbol}`)

    // Try to get from stock master service if available
    try {
      const stockMasterService = require("../services/stockMasterService")
      const stockDetails = await stockMasterService.getStockDetails(symbol, authToken)

      // If stock has options, fetch comprehensive option chain data
      if (stockDetails.derivatives.hasOptions && authToken) {
        console.log(`📊 Fetching comprehensive option chain for ${symbol}`)

        try {
          // First, try to fetch fresh option chain data
          const optionResult = await optionChainService.fetchOptionChainData(authToken, symbol)

          if (optionResult.success) {
            // Get all options from cache
            const allOptions = await optionChainService.getAllOptionsFromCache(symbol)

            if (allOptions && allOptions.length > 0) {
              // Group options by strike and expiry
              const optionChainByStrike = {}

              allOptions.forEach((option) => {
                const key = `${option.expiry}_${option.strike}`

                if (!optionChainByStrike[key]) {
                  optionChainByStrike[key] = {
                    strike: option.strike,
                    expiry: option.expiry,
                    underlying: option.underlying,
                    CE: null,
                    PE: null,
                  }
                }

                // Add the option data based on type
                if (option.optionType === "CE") {
                  optionChainByStrike[key].CE = {
                    token: option.token,
                    symbol: option.symbol,
                    underlying: option.underlying,
                    strike: option.strike,
                    optionType: option.optionType,
                    expiry: option.expiry,
                    ltp: option.ltp || 0,
                    price: option.price || option.ltp || 0,
                    change: option.change || 0,
                    changePercent: option.changePercent || 0,
                    open: option.open || 0,
                    high: option.high || 0,
                    low: option.low || 0,
                    close: option.close || 0,
                    volume: option.volume || 0,
                    openInterest: option.openInterest || 0,
                    changeInOI: option.changeInOI || 0,
                    impliedVolatility: option.impliedVolatility || 0,
                    delta: option.delta || 0,
                    gamma: option.gamma || 0,
                    theta: option.theta || 0,
                    vega: option.vega || 0,
                    lotSize: option.lotSize || 1,
                    timestamp: option.timestamp || new Date().toISOString(),
                  }
                } else if (option.optionType === "PE") {
                  optionChainByStrike[key].PE = {
                    token: option.token,
                    symbol: option.symbol,
                    underlying: option.underlying,
                    strike: option.strike,
                    optionType: option.optionType,
                    expiry: option.expiry,
                    ltp: option.ltp || 0,
                    price: option.price || option.ltp || 0,
                    change: option.change || 0,
                    changePercent: option.changePercent || 0,
                    open: option.open || 0,
                    high: option.high || 0,
                    low: option.low || 0,
                    close: option.close || 0,
                    volume: option.volume || 0,
                    openInterest: option.openInterest || 0,
                    changeInOI: option.changeInOI || 0,
                    impliedVolatility: option.impliedVolatility || 0,
                    delta: option.delta || 0,
                    gamma: option.gamma || 0,
                    theta: option.theta || 0,
                    vega: option.vega || 0,
                    lotSize: option.lotSize || 1,
                    timestamp: option.timestamp || new Date().toISOString(),
                  }
                }
              })

              // Convert to array and sort by expiry then strike
              const sortedOptionChain = Object.values(optionChainByStrike).sort((a, b) => {
                if (a.expiry !== b.expiry) {
                  return a.expiry.localeCompare(b.expiry)
                }
                return a.strike - b.strike
              })

              // Add option chain to stock details
              stockDetails.optionChain = sortedOptionChain
              stockDetails.optionChainSummary = {
                totalStrikes: sortedOptionChain.length,
                totalCallOptions: sortedOptionChain.filter((item) => item.CE).length,
                totalPutOptions: sortedOptionChain.filter((item) => item.PE).length,
                availableExpiries: [...new Set(sortedOptionChain.map((item) => item.expiry))].sort(),
                strikeRange: {
                  min: Math.min(...sortedOptionChain.map((item) => item.strike)),
                  max: Math.max(...sortedOptionChain.map((item) => item.strike)),
                },
              }

              console.log(`✅ Added ${sortedOptionChain.length} option strikes to ${symbol} details`)
            }
          }
        } catch (optionError) {
          console.error(`❌ Error fetching option chain for ${symbol}:`, optionError.message)
          // Continue without option chain data
        }
      }

      res.json({
        success: true,
        data: stockDetails,
        symbol: symbol.toUpperCase(),
        hasLiveData: !!authToken,
        hasOptionChain: !!(stockDetails.optionChain && stockDetails.optionChain.length > 0),
        timestamp: new Date().toISOString(),
        source: "comprehensive_stock_details_with_options",
      })
    } catch (serviceError) {
      console.error("❌ Stock master service error:", serviceError.message)

      // Fallback to basic stock info
      const { searchStocks } = require("../config/stockConfig")
      const searchResults = searchStocks(symbol)

      if (searchResults.length > 0) {
        const stock = searchResults[0]

        // Check if this is an option underlying and try to get option data
        let optionChain = []
        let optionChainSummary = null

        if (stock.type === "OPTION_CHAIN" && authToken) {
          try {
            console.log(`📊 Fetching option chain for underlying ${symbol}`)
            const optionResult = await optionChainService.fetchOptionChainData(authToken, symbol)

            if (optionResult.success) {
              const allOptions = await optionChainService.getAllOptionsFromCache(symbol)

              if (allOptions && allOptions.length > 0) {
                // Group options by strike and expiry (same logic as above)
                const optionChainByStrike = {}

                allOptions.forEach((option) => {
                  const key = `${option.expiry}_${option.strike}`

                  if (!optionChainByStrike[key]) {
                    optionChainByStrike[key] = {
                      strike: option.strike,
                      expiry: option.expiry,
                      underlying: option.underlying,
                      CE: null,
                      PE: null,
                    }
                  }

                  const optionData = {
                    token: option.token,
                    symbol: option.symbol,
                    underlying: option.underlying,
                    strike: option.strike,
                    optionType: option.optionType,
                    expiry: option.expiry,
                    ltp: option.ltp || 0,
                    price: option.price || option.ltp || 0,
                    change: option.change || 0,
                    changePercent: option.changePercent || 0,
                    open: option.open || 0,
                    high: option.high || 0,
                    low: option.low || 0,
                    close: option.close || 0,
                    volume: option.volume || 0,
                    openInterest: option.openInterest || 0,
                    changeInOI: option.changeInOI || 0,
                    impliedVolatility: option.impliedVolatility || 0,
                    delta: option.delta || 0,
                    gamma: option.gamma || 0,
                    theta: option.theta || 0,
                    vega: option.vega || 0,
                    lotSize: option.lotSize || 1,
                    timestamp: option.timestamp || new Date().toISOString(),
                  }

                  if (option.optionType === "CE") {
                    optionChainByStrike[key].CE = optionData
                  } else if (option.optionType === "PE") {
                    optionChainByStrike[key].PE = optionData
                  }
                })

                optionChain = Object.values(optionChainByStrike).sort((a, b) => {
                  if (a.expiry !== b.expiry) {
                    return a.expiry.localeCompare(b.expiry)
                  }
                  return a.strike - b.strike
                })

                optionChainSummary = {
                  totalStrikes: optionChain.length,
                  totalCallOptions: optionChain.filter((item) => item.CE).length,
                  totalPutOptions: optionChain.filter((item) => item.PE).length,
                  availableExpiries: [...new Set(optionChain.map((item) => item.expiry))].sort(),
                  strikeRange: {
                    min: Math.min(...optionChain.map((item) => item.strike)),
                    max: Math.max(...optionChain.map((item) => item.strike)),
                  },
                }
              }
            }
          } catch (optionError) {
            console.error(`❌ Error fetching option chain for ${symbol}:`, optionError.message)
          }
        }

        res.json({
          success: true,
          data: {
            basic: stock,
            priceRanges: null,
            derivatives: {
              hasFutures: false,
              hasOptions: stock.type === "OPTION_CHAIN",
              futures: [],
              options: [],
              expiries: [],
            },
            optionChain: optionChain,
            optionChainSummary: optionChainSummary,
          },
          symbol: symbol.toUpperCase(),
          hasLiveData: !!authToken,
          hasOptionChain: optionChain.length > 0,
          timestamp: new Date().toISOString(),
          source: "basic_stock_config_with_options",
        })
      } else {
        throw new Error(`Stock ${symbol} not found`)
      }
    }
  } catch (error) {
    console.error("❌ Error getting stock details:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      symbol: req.params.symbol,
    })
  }
}

// NEW: Get comprehensive option chain with all strikes and expiries
const getComprehensiveOptionChain = async (req, res) => {
  try {
    const { underlying } = req.params
    const { expiry } = req.query

    console.log(`📊 Getting comprehensive option chain for ${underlying}${expiry ? ` (expiry: ${expiry})` : ""}`)

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live option chain data",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()

    // Fetch fresh option chain data
    const result = await optionChainService.fetchOptionChainData(authToken, underlying)

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to fetch option data for ${underlying}`,
        underlying: underlying.toUpperCase(),
      })
    }

    // Get all options from cache
    const allOptions = await optionChainService.getAllOptionsFromCache(underlying)

    if (!allOptions || allOptions.length === 0) {
      return res.json({
        success: true,
        underlying: underlying.toUpperCase(),
        optionChain: [],
        optionChainSummary: {
          totalStrikes: 0,
          totalCallOptions: 0,
          totalPutOptions: 0,
          availableExpiries: [],
          strikeRange: { min: 0, max: 0 },
        },
        message: "No option data available",
        fetchTime: result.fetchTime,
        source: "live_api",
      })
    }

    // Filter by expiry if specified
    const filteredOptions = expiry ? allOptions.filter((option) => option.expiry === expiry) : allOptions

    // Group options by strike and expiry
    const optionChainByStrike = {}

    filteredOptions.forEach((option) => {
      const key = `${option.expiry}_${option.strike}`

      if (!optionChainByStrike[key]) {
        optionChainByStrike[key] = {
          strike: option.strike,
          expiry: option.expiry,
          underlying: option.underlying,
          CE: null,
          PE: null,
        }
      }

      const optionData = {
        token: option.token,
        symbol: option.symbol,
        underlying: option.underlying,
        strike: option.strike,
        optionType: option.optionType,
        expiry: option.expiry,
        ltp: option.ltp || 0,
        price: option.price || option.ltp || 0,
        change: option.change || 0,
        changePercent: option.changePercent || 0,
        open: option.open || 0,
        high: option.high || 0,
        low: option.low || 0,
        close: option.close || 0,
        volume: option.volume || 0,
        openInterest: option.openInterest || 0,
        changeInOI: option.changeInOI || 0,
        impliedVolatility: option.impliedVolatility || 0,
        delta: option.delta || 0,
        gamma: option.gamma || 0,
        theta: option.theta || 0,
        vega: option.vega || 0,
        lotSize: option.lotSize || 1,
        timestamp: option.timestamp || new Date().toISOString(),
      }

      if (option.optionType === "CE") {
        optionChainByStrike[key].CE = optionData
      } else if (option.optionType === "PE") {
        optionChainByStrike[key].PE = optionData
      }
    })

    // Convert to array and sort by expiry then strike
    const sortedOptionChain = Object.values(optionChainByStrike).sort((a, b) => {
      if (a.expiry !== b.expiry) {
        return a.expiry.localeCompare(b.expiry)
      }
      return a.strike - b.strike
    })

    const optionChainSummary = {
      totalStrikes: sortedOptionChain.length,
      totalCallOptions: sortedOptionChain.filter((item) => item.CE).length,
      totalPutOptions: sortedOptionChain.filter((item) => item.PE).length,
      availableExpiries: [...new Set(allOptions.map((item) => item.expiry))].sort(),
      strikeRange:
        sortedOptionChain.length > 0
          ? {
              min: Math.min(...sortedOptionChain.map((item) => item.strike)),
              max: Math.max(...sortedOptionChain.map((item) => item.strike)),
            }
          : { min: 0, max: 0 },
    }

    res.json({
      success: true,
      underlying: underlying.toUpperCase(),
      expiry: expiry || "all",
      optionChain: sortedOptionChain,
      optionChainSummary: optionChainSummary,
      fetchTime: result.fetchTime,
      source: "comprehensive_live_api",
    })
  } catch (error) {
    console.error("❌ Error getting comprehensive option chain:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      underlying: req.params.underlying,
    })
  }
}

module.exports = {
  getMarketData,
  getLatestPrices,
  getMarketDataBySymbol,
  fetchFreshData,
  getMarketStats,
  searchStocks,
  getOptionChain,
  fetchOptionChainData,
  getOptionsByExpiry,
  getOptionByStrike,
  getAvailableUnderlyings,
  getStockDetails,
  getComprehensiveOptionChain,
}
