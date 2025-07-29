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

    console.log(`📊 Getting option chain for ${underlying} with price ranges`)

    // First check cache
    const optionChain = await optionChainService.getOptionChainByUnderlying(underlying, expiry)

    // Get comprehensive underlying price data
    let underlyingPriceData = null
    if (authService.isAuthenticated()) {
      const authToken = authService.getAuthToken()
      try {
        underlyingPriceData = await marketDataService.getUnderlyingPriceRanges(authToken, underlying)
      } catch (priceError) {
        console.error(`❌ Error fetching price ranges for ${underlying}:`, priceError.message)
      }
    }

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
          underlyingPriceData: underlyingPriceData,
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
      underlyingPriceData: underlyingPriceData,
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

// NEW: Get all expiries for a specific strike
const getOptionsByStrike = async (req, res) => {
  try {
    const { underlying, strike } = req.params
    const strikePrice = Number.parseInt(strike)

    console.log(`📊 Getting all expiries for ${underlying} strike ${strikePrice}`)

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live option data",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()

    // Get all options from cache
    let optionData = await optionChainService.getAllOptionsFromCache(underlying)

    // If no cached data, fetch fresh
    if (optionData.length === 0) {
      console.log(`📊 No cached data, fetching fresh option chain for ${underlying}`)
      const result = await optionChainService.fetchOptionChainData(authToken, underlying)
      if (result.success) {
        optionData = await optionChainService.getAllOptionsFromCache(underlying)
      }
    }

    // Filter for specific strike price
    const strikeOptions = optionData.filter((option) => option.strike === strikePrice)

    if (strikeOptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No option data found for ${underlying} strike ${strikePrice}`,
        strikePrice: strikePrice,
        underlying: underlying.toUpperCase(),
        availableStrikes: [...new Set(optionData.map((opt) => opt.strike))].sort((a, b) => a - b),
      })
    }

    // Group by expiry
    const groupedByExpiry = {}
    strikeOptions.forEach((option) => {
      if (!groupedByExpiry[option.expiry]) {
        groupedByExpiry[option.expiry] = {
          expiry: option.expiry,
          strike: strikePrice,
          underlying: underlying.toUpperCase(),
          CE: null,
          PE: null,
        }
      }
      groupedByExpiry[option.expiry][option.optionType] = option
    })

    const results = Object.values(groupedByExpiry).sort((a, b) => a.expiry.localeCompare(b.expiry))

    res.json({
      success: true,
      strikePrice: strikePrice,
      underlying: underlying.toUpperCase(),
      results: results,
      availableExpiries: results.map((r) => r.expiry),
      count: results.length,
      timestamp: new Date().toISOString(),
      source: "live_api_strike_search",
    })
  } catch (error) {
    console.error("❌ Error getting options by strike:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      strikePrice: req.params.strike,
      underlying: req.params.underlying,
    })
  }
}

// Get specific strike price data with flexible expiry matching
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
    let optionData = await optionChainService.getAllOptionsFromCache(underlying)

    // If no cached data, fetch fresh
    if (optionData.length === 0) {
      console.log(`📊 No cached data, fetching fresh option chain for ${underlying}`)
      const result = await optionChainService.fetchOptionChainData(authToken, underlying)
      if (result.success) {
        optionData = await optionChainService.getAllOptionsFromCache(underlying)
      }
    }

    // Filter for specific strike price
    const strikeOptions = optionData.filter((option) => option.strike === strikePrice)

    if (strikeOptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No option data found for ${underlying} strike ${strikePrice}`,
        strikePrice: strikePrice,
        underlying: underlying.toUpperCase(),
        availableStrikes: [...new Set(optionData.map((opt) => opt.strike))].sort((a, b) => a - b),
        availableExpiries: [...new Set(optionData.map((opt) => opt.expiry))].sort(),
      })
    }

    // Try exact expiry match first
    let exactExpiryOptions = strikeOptions.filter((option) => option.expiry === expiry)

    // If no exact match, try flexible matching
    if (exactExpiryOptions.length === 0) {
      console.log(`📊 No exact expiry match for ${expiry}, trying flexible matching`)

      // Try partial date matching (e.g., "29JUL" matches "29JUL25")
      const partialMatch = strikeOptions.filter(
        (option) => option.expiry.includes(expiry) || expiry.includes(option.expiry),
      )

      if (partialMatch.length > 0) {
        exactExpiryOptions = partialMatch
        console.log(`📊 Found ${partialMatch.length} partial matches for expiry pattern: ${expiry}`)
      } else {
        // If still no match, get the nearest expiry
        const nearestExpiry = strikeOptions.reduce((nearest, current) => {
          return Math.abs(current.expiry.localeCompare(expiry)) < Math.abs(nearest.expiry.localeCompare(expiry))
            ? current
            : nearest
        })
        exactExpiryOptions = strikeOptions.filter((option) => option.expiry === nearestExpiry.expiry)
        console.log(`📊 Using nearest expiry: ${nearestExpiry.expiry}`)
      }
    }

    // Find call and put options
    const callOption = exactExpiryOptions.find((option) => option.optionType === "CE")
    const putOption = exactExpiryOptions.find((option) => option.optionType === "PE")

    // Get the actual expiry being used
    const actualExpiry = exactExpiryOptions[0]?.expiry || expiry

    // Format response
    const response = {
      strikePrice: strikePrice,
      requestedExpiry: expiry,
      actualExpiry: actualExpiry,
      underlying: underlying.toUpperCase(),
      fetchTime: new Date().toISOString(),
      source: "live_api_with_flexible_matching",
      matchType: exactExpiryOptions[0]?.expiry === expiry ? "exact" : "flexible",
      availableExpiriesForStrike: [...new Set(strikeOptions.map((opt) => opt.expiry))].sort(),
    }

    if (callOption) {
      response.callOption = {
        symbol: callOption.symbol,
        token: callOption.token,
        lastTradedPrice: callOption.ltp || 0,
        price: callOption.price || callOption.ltp || 0,
        openInterest: callOption.openInterest || 0,
        changeInOI: callOption.changeInOI || 0,
        volume: callOption.volume || 0,
        change: callOption.change || 0,
        changePercent: callOption.changePercent || 0,
        high: callOption.high || 0,
        low: callOption.low || 0,
        open: callOption.open || 0,
        close: callOption.close || 0,
        impliedVolatility: callOption.impliedVolatility || 0,
        delta: callOption.delta || 0,
        gamma: callOption.gamma || 0,
        theta: callOption.theta || 0,
        vega: callOption.vega || 0,
        lotSize: callOption.lotSize || 1,
        expiry: callOption.expiry,
      }
    }

    if (putOption) {
      response.putOption = {
        symbol: putOption.symbol,
        token: putOption.token,
        lastTradedPrice: putOption.ltp || 0,
        price: putOption.price || putOption.ltp || 0,
        openInterest: putOption.openInterest || 0,
        changeInOI: putOption.changeInOI || 0,
        volume: callOption.change || 0,
        changePercent: putOption.changePercent || 0,
        high: putOption.high || 0,
        low: putOption.low || 0,
        open: putOption.open || 0,
        close: putOption.close || 0,
        impliedVolatility: putOption.impliedVolatility || 0,
        delta: callOption.delta || 0,
        gamma: callOption.gamma || 0,
        theta: callOption.theta || 0,
        vega: callOption.vega || 0,
        lotSize: callOption.lotSize || 1,
        expiry: putOption.expiry,
      }
    }

    // Add summary if both options found
    if (callOption && putOption) {
      response.summary = {
        totalVolume: (callOption.volume || 0) + (putOption.volume || 0),
        totalOI: (callOption.openInterest || 0) + (putOption.openInterest || 0),
        putCallRatio: callOption.openInterest > 0 ? (putOption.openInterest / callOption.openInterest).toFixed(2) : 0,
        straddlePrice: (callOption.ltp || 0) + (putOption.ltp || 0),
      }
    }

    res.json(response)
  } catch (error) {
    console.error("❌ Error getting option by strike:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      strikePrice: req.params.strike,
      requestedExpiry: req.params.expiry,
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

// Enhanced stock details function with comprehensive price data for all stocks
const getStockDetails = async (req, res) => {
  try {
    const { symbol } = req.params
    const authToken = authService.getAuthToken()

    console.log(`📊 Getting comprehensive details for ${symbol}`)
    console.log(`🔐 Auth token available: ${!!authToken}`)
    console.log(`🔐 Is authenticated: ${authService.isAuthenticated()}`)

    // Check authentication status first
    const authStatus = authService.isAuthenticated()
    if (!authStatus) {
      console.log("❌ User not authenticated, trying to login...")

      // Try to auto-login if not authenticated
      try {
        await authService.login()
        console.log("✅ Auto-login successful")
      } catch (loginError) {
        console.error("❌ Auto-login failed:", loginError.message)
        return res.status(401).json({
          success: false,
          message: "Authentication required for live stock data. Please login first.",
          loginEndpoint: "/api/auth/login",
          symbol: symbol.toUpperCase(),
          authError: loginError.message,
        })
      }
    }

    // Get fresh auth token after potential login
    const freshAuthToken = authService.getAuthToken()
    console.log(`🔐 Fresh auth token available: ${!!freshAuthToken}`)

    if (!freshAuthToken) {
      return res.status(401).json({
        success: false,
        message: "No authentication token available",
        loginEndpoint: "/api/auth/login",
        symbol: symbol.toUpperCase(),
      })
    }

    // Use enhanced stock master service for all stocks
    const stockMasterService = require("../services/stockMasterService")

    try {
      console.log(`📊 Fetching stock details from stock master service for ${symbol}`)
      const stockDetails = await stockMasterService.getStockDetails(symbol, freshAuthToken)

      // Debug: Log what we got from stock master service
      console.log(`📊 Stock details result for ${symbol}:`, {
        hasBasic: !!stockDetails.basic,
        hasPriceRanges: !!stockDetails.priceRanges,
        hasDerivatives: !!stockDetails.derivatives,
        priceRangesKeys: stockDetails.priceRanges ? Object.keys(stockDetails.priceRanges) : null,
      })

      let currentPrice = null
      let high52Week = null
      let low52Week = null
      let estimatedMonthlyHigh = null
      let estimatedMonthlyLow = null

      if (stockDetails.priceRanges) {
        currentPrice = stockDetails.priceRanges.current?.ltp || null
        high52Week = stockDetails.priceRanges.yearly?.high52Week || null
        low52Week = stockDetails.priceRanges.yearly?.low52Week || null

        if (currentPrice && high52Week && low52Week) {
          estimatedMonthlyHigh = Math.min(high52Week, currentPrice * 1.12)
          estimatedMonthlyLow = Math.max(low52Week, currentPrice * 0.88)
        }
      } else {
        // Fetch price data from general market data if stockDetails.priceRanges is null
        const result = await marketDataService.fetchMarketData(freshAuthToken, "FULL")
        const stockData = result.data?.find(
          (item) => item.symbol?.toUpperCase() === symbol.toUpperCase() || item.token === stockDetails.basic.token,
        )

        if (stockData) {
          currentPrice = stockData.ltp || null
          high52Week = stockData.weekHigh52 || null
          low52Week = stockData.weekLow52 || null

          if (currentPrice && high52Week && low52Week) {
            estimatedMonthlyHigh = Math.min(high52Week, currentPrice * 1.12)
            estimatedMonthlyLow = Math.max(low52Week, currentPrice * 0.88)
          }
        }
      }

      // NEW: If stock has options, fetch and include the comprehensive option chain
      if (stockDetails.derivatives.hasOptions) {
        try {
          console.log(`📊 Fetching comprehensive option chain for ${symbol} within stock details.`)
          const optionChainResult = await optionChainService.fetchOptionChainData(freshAuthToken, symbol)

          if (optionChainResult.success) {
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
                const optionData = {
                  // Re-create optionData to ensure all fields are present and formatted
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

              stockDetails.optionChain = sortedOptionChain
              stockDetails.optionChainSummary = optionChainSummary
              console.log(`✅ Added option chain data for ${symbol} (${sortedOptionChain.length} strikes)`)
            } else {
              console.log(`⚠️ No option data found for ${symbol} after fetch.`)
            }
          } else {
            console.error(`❌ Failed to fetch option chain data for ${symbol}: ${optionChainResult.message}`)
          }
        } catch (optionError) {
          console.error(`❌ Error fetching option chain for ${symbol}:`, optionError.message)
        }
      }

      res.json({
        success: true,
        data: stockDetails, // Now includes optionChain and optionChainSummary
        symbol: symbol.toUpperCase(),
        hasLiveData: !!freshAuthToken,
        hasOptionChain: stockDetails.derivatives.hasOptions, // This should reflect if options are available
        currentPrice: currentPrice !== null ? Number.parseFloat(currentPrice.toFixed(2)) : null,
        high52Week: high52Week !== null ? Number.parseFloat(high52Week.toFixed(2)) : null,
        low52Week: low52Week !== null ? Number.parseFloat(low52Week.toFixed(2)) : null,
        estimatedMonthlyHigh: estimatedMonthlyHigh !== null ? Number.parseFloat(estimatedMonthlyHigh.toFixed(2)) : null,
        estimatedMonthlyLow: estimatedMonthlyLow !== null ? Number.parseFloat(estimatedMonthlyLow.toFixed(2)) : null,
        timestamp: new Date().toISOString(),
        source: stockDetails.priceRanges ? "comprehensive_stock_master_with_live_data" : "basic_stock_data_only",
        debugInfo: {
          authTokenAvailable: !!freshAuthToken,
          stockMasterFound: !!stockDetails.basic,
          priceDataFetched: !!stockDetails.priceRanges,
          marketDataAttempted: true,
          optionChainIncluded: !!stockDetails.optionChain, // New debug info
        },
      })
    } catch (serviceError) {
      console.error("❌ Stock master service error:", serviceError.message)

      // Fallback to basic stock info from static config
      const { searchStocks } = require("../config/stockConfig")
      const searchResults = searchStocks(symbol)

      if (searchResults.length > 0) {
        const stock = searchResults[0]

        res.json({
          success: true,
          data: {
            basic: stock,
            derivatives: {
              hasFutures: false,
              hasOptions: stock.type === "OPTION_CHAIN",
              futures: [],
              options: [],
              expiries: [],
            },
            optionChain: [],
            optionChainSummary: null,
          },
          symbol: symbol.toUpperCase(),
          hasLiveData: !!freshAuthToken,
          hasOptionChain: false,
          timestamp: new Date().toISOString(),
          source: "fallback_static_config_only",
          debugInfo: {
            authTokenAvailable: !!freshAuthToken,
            fallbackUsed: true,
            serviceError: serviceError.message,
          },
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
      timestamp: new Date().toISOString(),
      debugInfo: {
        authTokenAvailable: !!authService.getAuthToken(),
        isAuthenticated: authService.isAuthenticated(),
        errorType: error.name,
        errorMessage: error.message,
      },
    })
  }
}

// NEW: Get comprehensive option chain with all strikes and expiries
const getComprehensiveOptionChain = async (req, res) => {
  try {
    const { underlying } = req.params
    const { expiry } = req.query

    console.log(
      `📊 Getting comprehensive option chain for ${underlying}${expiry ? ` (expiry: ${expiry})` : ""} with price ranges`,
    )

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live option chain data",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()

    // Fetch comprehensive underlying price data
    let underlyingPriceData = null
    try {
      underlyingPriceData = await marketDataService.getUnderlyingPriceRanges(authToken, underlying)
      console.log(`📊 Fetched price ranges for ${underlying}:`, underlyingPriceData)
    } catch (priceError) {
      console.error(`❌ Error fetching price ranges for ${underlying}:`, priceError.message)
    }

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
        underlyingPriceData: underlyingPriceData,
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
      underlyingPriceData: underlyingPriceData,
      optionChainSummary: optionChainSummary,
      fetchTime: result.fetchTime,
      source: "comprehensive_live_api_with_price_ranges",
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

// NEW: Flexible option search with partial matching
const searchOptionsByStrikeAndExpiry = async (req, res) => {
  try {
    const { underlying } = req.params
    const { strike, expiry, limit = 10 } = req.query

    console.log(`🔍 Flexible search for ${underlying} - strike: ${strike}, expiry: ${expiry}`)

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for option search",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()

    // Get all options from cache
    let optionData = await optionChainService.getAllOptionsFromCache(underlying)

    // If no cached data, fetch fresh
    if (optionData.length === 0) {
      console.log(`📊 No cached data, fetching fresh option chain for ${underlying}`)
      const result = await optionChainService.fetchOptionChainData(authToken, underlying)
      if (result.success) {
        optionData = await optionChainService.getAllOptionsFromCache(underlying)
      }
    }

    let filteredOptions = optionData

    // Filter by strike if provided
    if (strike) {
      const strikeNum = Number.parseInt(strike)
      if (!isNaN(strikeNum)) {
        // Exact strike match
        filteredOptions = filteredOptions.filter((opt) => opt.strike === strikeNum)
      } else {
        // Partial strike matching (e.g., "501" matches 50100, 50150, etc.)
        filteredOptions = filteredOptions.filter((opt) => opt.strike.toString().includes(strike.toString()))
      }
    }

    // Filter by expiry if provided
    if (expiry) {
      filteredOptions = filteredOptions.filter(
        (opt) => opt.expiry.includes(expiry.toUpperCase()) || expiry.toUpperCase().includes(opt.expiry),
      )
    }

    // Group by strike and expiry
    const groupedOptions = {}
    filteredOptions.forEach((option) => {
      const key = `${option.strike}_${option.expiry}`
      if (!groupedOptions[key]) {
        groupedOptions[key] = {
          strike: option.strike,
          expiry: option.expiry,
          underlying: option.underlying,
          CE: null,
          PE: null,
        }
      }
      groupedOptions[key][option.optionType] = option
    })

    // Convert to array and sort
    const sortedResults = Object.values(groupedOptions)
      .sort((a, b) => {
        if (a.expiry !== b.expiry) return a.expiry.localeCompare(b.expiry)
        return a.strike - b.strike
      })
      .slice(0, Number.parseInt(limit))

    // Calculate summary statistics
    const summary = {
      totalResults: sortedResults.length,
      strikeRange:
        sortedResults.length > 0
          ? {
              min: Math.min(...sortedResults.map((r) => r.strike)),
              max: Math.max(...sortedResults.map((r) => r.strike)),
            }
          : null,
      expiries: [...new Set(sortedResults.map((r) => r.expiry))].sort(),
      totalVolume: filteredOptions.reduce((sum, opt) => sum + (opt.volume || 0), 0),
      totalOI: filteredOptions.reduce((sum, opt) => sum + (opt.openInterest || 0), 0),
    }

    res.json({
      success: true,
      underlying: underlying.toUpperCase(),
      searchCriteria: {
        strike: strike || "all",
        expiry: expiry || "all",
        limit: Number.parseInt(limit),
      },
      results: sortedResults,
      summary: summary,
      timestamp: new Date().toISOString(),
      source: "flexible_option_search",
    })
  } catch (error) {
    console.error("❌ Error in flexible option search:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      underlying: req.params.underlying,
    })
  }
}

// NEW: Live Options Data API for Add Call functionality
const getLiveOptionsData = async (req, res) => {
  try {
    const { segment, instrument, script, expiry, strike, limit = 50 } = req.query

    console.log(`📊 Fetching live options data with filters:`, {
      segment,
      instrument,
      script,
      expiry,
      strike,
      limit,
    })

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for live options data",
        loginEndpoint: "/api/auth/login",
      })
    }

    const authToken = authService.getAuthToken()
    const stockMasterService = require("../services/stockMasterService")

    // Build search filters
    const searchFilters = {
      limit: Number.parseInt(limit),
      exchanges: ["NFO", "BFO"], // Options exchanges
      instrumentTypes: ["OPTIDX", "OPTSTK"], // Option instrument types
    }

    // Apply segment filter
    if (segment) {
      if (segment.toLowerCase() === "equity") {
        searchFilters.instrumentTypes = ["OPTSTK"]
      } else if (segment.toLowerCase() === "index") {
        searchFilters.instrumentTypes = ["OPTIDX"]
      }
    }

    // Get all option instruments
    let optionInstruments = stockMasterService.stockMaster.filter(
      (stock) =>
        searchFilters.instrumentTypes.includes(stock.instrumenttype) &&
        searchFilters.exchanges.includes(stock.exch_seg),
    )

    // Apply instrument filter (e.g., NIFTY, BANKNIFTY)
    if (instrument) {
      optionInstruments = optionInstruments.filter((stock) =>
        stock.symbol.toUpperCase().includes(instrument.toUpperCase()),
      )
    }

    // Apply script filter (specific underlying)
    if (script) {
      optionInstruments = optionInstruments.filter((stock) =>
        stock.symbol.toUpperCase().startsWith(script.toUpperCase()),
      )
    }

    // Apply expiry filter
    if (expiry) {
      optionInstruments = optionInstruments.filter((stock) => stock.expiry && stock.expiry.includes(expiry))
    }

    // Apply strike filter
    if (strike) {
      const strikeNum = Number.parseFloat(strike)
      optionInstruments = optionInstruments.filter(
        (stock) => stock.strike && Math.abs(Number.parseFloat(stock.strike) - strikeNum) < 0.01,
      )
    }

    // Limit results
    optionInstruments = optionInstruments.slice(0, Number.parseInt(limit))

    // Get live prices for these instruments
    const tokens = optionInstruments.map((stock) => stock.token)
    let liveData = []

    if (tokens.length > 0) {
      try {
        const exchangeTokens = {
          NFO: tokens.filter((token) => {
            const stock = stockMasterService.getStockByToken(token)
            return stock && stock.exch_seg === "NFO"
          }),
          BFO: tokens.filter((token) => {
            const stock = stockMasterService.getStockByToken(token)
            return stock && stock.exch_seg === "BFO"
          }),
        }

        const result = await marketDataService.fetchMarketData(authToken, "FULL", exchangeTokens)
        liveData = result.data || []
      } catch (priceError) {
        console.error("❌ Error fetching live prices:", priceError.message)
      }
    }

    // Combine instrument data with live prices
    const enrichedData = optionInstruments.map((instrument) => {
      const livePrice = liveData.find((price) => price.token === instrument.token)

      // Extract option details from symbol
      const optionType = instrument.symbol.includes("CE") ? "CE" : "PE"
      const underlyingMatch = instrument.symbol.match(/^([A-Z]+)/)
      const underlying = underlyingMatch ? underlyingMatch[1] : "UNKNOWN"

      return {
        token: instrument.token,
        symbol: instrument.symbol,
        name: instrument.name || instrument.symbol,
        segment: instrument.instrumenttype === "OPTIDX" ? "Index" : "Equity",
        instrument: underlying,
        script: underlying,
        expiry: instrument.expiry,
        strike: Number.parseFloat(instrument.strike || 0),
        optionType: optionType,
        exchange: instrument.exch_seg,
        lotSize: instrument.lotsize || 1,

        // Live price data
        ltp: livePrice?.ltp || 0,
        change: livePrice?.change || 0,
        changePercent: livePrice?.changePercent || 0,
        volume: livePrice?.volume || 0,
        openInterest: 0, // Would need separate API call
        bid: 0,
        ask: 0,

        // Additional data
        timestamp: new Date().toISOString(),
        isLive: !!livePrice,
      }
    })

    res.json({
      success: true,
      data: enrichedData,
      filters: { segment, instrument, script, expiry, strike },
      count: enrichedData.length,
      hasLiveData: liveData.length > 0,
      timestamp: new Date().toISOString(),
      source: "live_options_api",
    })
  } catch (error) {
    console.error("❌ Error fetching live options data:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

// Add Call Position
const addCallPosition = async (req, res) => {
  try {
    const { segment, instrument, script, expiry, strike, quantity, orderType } = req.body

    console.log(`📊 Adding call position:`, req.body)

    // Validate required fields
    if (!segment || !instrument || !script || !expiry || !strike) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: segment, instrument, script, expiry, strike",
      })
    }

    if (!authService.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to add call position",
        loginEndpoint: "/api/auth/login",
      })
    }

    const stockMasterService = require("../services/stockMasterService")

    // Find the specific option contract
    const optionContract = stockMasterService.stockMaster.find(
      (stock) =>
        stock.symbol.toUpperCase().startsWith(script.toUpperCase()) &&
        stock.expiry === expiry &&
        Number.parseFloat(stock.strike) === Number.parseFloat(strike) &&
        stock.symbol.includes("CE"), // Call option
    )

    if (!optionContract) {
      return res.status(404).json({
        success: false,
        message: `Call option not found for ${script} ${expiry} ${strike} CE`,
      })
    }

    // Get current live price
    const authToken = authService.getAuthToken()
    let currentPrice = 0

    try {
      const exchangeTokens = {
        [optionContract.exch_seg]: [optionContract.token],
      }
      const result = await marketDataService.fetchMarketData(authToken, "FULL", exchangeTokens)
      const priceData = result.data?.[0]
      currentPrice = priceData?.ltp || 0
    } catch (priceError) {
      console.error("❌ Error fetching current price:", priceError.message)
    }

    // Create position record (in a real app, this would be saved to database)
    const position = {
      id: Date.now().toString(),
      token: optionContract.token,
      symbol: optionContract.symbol,
      segment: segment,
      instrument: instrument,
      script: script,
      expiry: expiry,
      strike: Number.parseFloat(strike),
      optionType: "CE",
      quantity: Number.parseInt(quantity) || 1,
      orderType: orderType || "BUY",
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      pnl: 0,
      lotSize: optionContract.lotsize || 1,
      exchange: optionContract.exch_seg,
      timestamp: new Date().toISOString(),
      status: "ACTIVE",
    }

    res.json({
      success: true,
      message: "Call position added successfully",
      position: position,
      marketData: {
        currentPrice: currentPrice,
        symbol: optionContract.symbol,
        lotSize: optionContract.lotsize,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error adding call position:", error)
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

// Get instruments by segment
const getInstrumentsBySegment = async (req, res) => {
  try {
    const { segment } = req.params
    const stockMasterService = require("../services/stockMasterService")

    let instrumentTypes = []
    if (segment.toLowerCase() === "equity") {
      instrumentTypes = ["OPTSTK"]
    } else if (segment.toLowerCase() === "index") {
      instrumentTypes = ["OPTIDX"]
    } else {
      instrumentTypes = ["OPTIDX", "OPTSTK"]
    }

    // Get unique underlying instruments
    const instruments = new Set()
    stockMasterService.stockMaster
      .filter((stock) => instrumentTypes.includes(stock.instrumenttype))
      .forEach((stock) => {
        const underlyingMatch = stock.symbol.match(/^([A-Z]+)/)
        if (underlyingMatch) {
          instruments.add(underlyingMatch[1])
        }
      })

    const instrumentList = Array.from(instruments)
      .sort()
      .map((instrument) => ({
        value: instrument,
        label: instrument,
        segment: segment,
      }))

    res.json({
      success: true,
      data: instrumentList,
      segment: segment,
      count: instrumentList.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error fetching instruments:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Get scripts by instrument
const getScriptsByInstrument = async (req, res) => {
  try {
    const { instrument } = req.params
    const stockMasterService = require("../services/stockMasterService")

    // For most cases, script is same as instrument
    // But we can return variations if they exist
    const scripts = new Set()
    stockMasterService.stockMaster
      .filter(
        (stock) =>
          (stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK") &&
          stock.symbol.toUpperCase().startsWith(instrument.toUpperCase()),
      )
      .forEach((stock) => {
        const underlyingMatch = stock.symbol.match(/^([A-Z]+)/)
        if (underlyingMatch) {
          scripts.add(underlyingMatch[1])
        }
      })

    const scriptList = Array.from(scripts)
      .sort()
      .map((script) => ({
        value: script,
        label: script,
        instrument: instrument,
      }))

    res.json({
      success: true,
      data: scriptList,
      instrument: instrument,
      count: scriptList.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error fetching scripts:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Get expiries by script
const getExpiriesByScript = async (req, res) => {
  try {
    const { script } = req.params
    const stockMasterService = require("../services/stockMasterService")

    const expiries = new Set()
    stockMasterService.stockMaster
      .filter(
        (stock) =>
          (stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK") &&
          stock.symbol.toUpperCase().startsWith(script.toUpperCase()) &&
          stock.expiry,
      )
      .forEach((stock) => {
        expiries.add(stock.expiry)
      })

    const expiryList = Array.from(expiries)
      .sort((a, b) => new Date(a) - new Date(b))
      .map((expiry) => ({
        value: expiry,
        label: expiry,
        script: script,
      }))

    res.json({
      success: true,
      data: expiryList,
      script: script,
      count: expiryList.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error fetching expiries:", error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Get strikes by script and expiry
const getStrikesByScriptAndExpiry = async (req, res) => {
  try {
    const { script, expiry } = req.params
    const stockMasterService = require("../services/stockMasterService")

    const strikes = new Set()
    stockMasterService.stockMaster
      .filter(
        (stock) =>
          (stock.instrumenttype === "OPTIDX" || stock.instrumenttype === "OPTSTK") &&
          stock.symbol.toUpperCase().startsWith(script.toUpperCase()) &&
          stock.expiry === expiry &&
          stock.strike,
      )
      .forEach((stock) => {
        strikes.add(Number.parseFloat(stock.strike))
      })

    const strikeList = Array.from(strikes)
      .sort((a, b) => a - b)
      .map((strike) => ({
        value: strike,
        label: strike.toString(),
        script: script,
        expiry: expiry,
      }))

    res.json({
      success: true,
      data: strikeList,
      script: script,
      expiry: expiry,
      count: strikeList.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Error fetching strikes:", error)
    res.status(500).json({
      success: false,
      message: error.message,
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
  getOptionsByStrike, // NEW
  getAvailableUnderlyings,
  getStockDetails,
  getComprehensiveOptionChain,
  searchOptionsByStrikeAndExpiry, // NEW
  getLiveOptionsData,
  addCallPosition,
  getInstrumentsBySegment,
  getScriptsByInstrument,
  getExpiriesByScript,
  getStrikesByScriptAndExpiry,
}
