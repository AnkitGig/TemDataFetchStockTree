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
        change: callOption.change || 0,
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

      // If we still don't have price ranges, try direct market data fetch
      if (!stockDetails.priceRanges && stockDetails.basic.token) {
        console.log(`📊 No price ranges found, trying direct market data fetch for ${symbol}`)

        try {
          // Try to get from general market data
          const result = await marketDataService.fetchMarketData(freshAuthToken, "FULL")
          console.log(`📊 Market data fetch result: ${result.data?.length || 0} records`)

          const stockData = result.data?.find(
            (item) => item.symbol?.toUpperCase() === symbol.toUpperCase() || item.token === stockDetails.basic.token,
          )

          if (stockData) {
            console.log(`✅ Found stock data in market feed for ${symbol}:`, {
              ltp: stockData.ltp,
              change: stockData.change,
              high: stockData.high,
              low: stockData.low,
            })

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
                  stockData.weekHigh52 > 0 && stockData.ltp > 0
                    ? Number.parseFloat(
                        (((stockData.ltp - stockData.weekHigh52) / stockData.weekHigh52) * 100).toFixed(2),
                      )
                    : 0,
                changeFrom52WeekLow:
                  stockData.weekLow52 > 0 && stockData.ltp > 0
                    ? Number.parseFloat(
                        (((stockData.ltp - stockData.weekLow52) / stockData.weekLow52) * 100).toFixed(2),
                      )
                    : 0,
              },
              circuits: {
                upperCircuit: Number.parseFloat((stockData.upperCircuit || 0).toFixed(2)),
                lowerCircuit: Number.parseFloat((stockData.lowerCircuit || 0).toFixed(2)),
                distanceFromUpperCircuit:
                  stockData.upperCircuit && stockData.ltp > 0
                    ? Number.parseFloat((((stockData.upperCircuit - stockData.ltp) / stockData.ltp) * 100).toFixed(2))
                    : 0,
                distanceFromLowerCircuit:
                  stockData.lowerCircuit && stockData.ltp > 0
                    ? Number.parseFloat((((stockData.ltp - stockData.lowerCircuit) / stockData.ltp) * 100).toFixed(2))
                    : 0,
              },
              metadata: {
                symbol: stockDetails.basic.symbol,
                token: stockDetails.basic.token,
                exchange: stockDetails.basic.exchange,
                instrumentType: stockDetails.basic.instrumentType,
                lastUpdated: new Date().toISOString(),
                dataSource: "angel_broking_market_data_direct",
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
              const estimatedWeeklyLow = Math.max(estimatedMonthlyLow, currentPrice * 0.95)

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

            console.log(`✅ Successfully added price data via direct market fetch for ${symbol}`)
          } else {
            console.log(`⚠️ Stock ${symbol} not found in market data feed`)
          }
        } catch (marketError) {
          console.error(`❌ Direct market data fetch failed for ${symbol}:`, marketError.message)
        }
      }

      // If stock has options, fetch comprehensive option chain data
      if (stockDetails.derivatives.hasOptions && freshAuthToken) {
        console.log(`📊 Fetching comprehensive option chain for ${symbol}`)

        try {
          // First, try to fetch fresh option chain data
          const optionResult = await optionChainService.fetchOptionChainData(freshAuthToken, symbol)

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

      // Log the final result
      console.log(`📊 Final stock details for ${symbol}:`, {
        hasPriceRanges: !!stockDetails.priceRanges,
        hasDerivatives: stockDetails.derivatives.hasFutures || stockDetails.derivatives.hasOptions,
        hasOptionChain: !!(stockDetails.optionChain && stockDetails.optionChain.length > 0),
        currentPrice: stockDetails.priceRanges?.current?.ltp || "N/A",
        source: stockDetails.priceRanges ? "live_data_with_prices" : "basic_data_only",
      })

      res.json({
        success: true,
        data: stockDetails,
        symbol: symbol.toUpperCase(),
        hasLiveData: !!freshAuthToken,
        hasOptionChain: !!(stockDetails.optionChain && stockDetails.optionChain.length > 0),
        timestamp: new Date().toISOString(),
        source: stockDetails.priceRanges ? "comprehensive_stock_master_with_live_data" : "basic_stock_data_only",
        debugInfo: {
          authTokenAvailable: !!freshAuthToken,
          stockMasterFound: !!stockDetails.basic,
          priceDataFetched: !!stockDetails.priceRanges,
          marketDataAttempted: true,
        },
      })
    } catch (serviceError) {
      console.error("❌ Stock master service error:", serviceError.message)

      // Fallback to basic stock info from static config
      const { searchStocks } = require("../config/stockConfig")
      const searchResults = searchStocks(symbol)

      if (searchResults.length > 0) {
        const stock = searchResults[0]

        // Try to get live price data even for fallback
        let priceRanges = null
        if (freshAuthToken && stock.token) {
          try {
            console.log(`📊 Trying fallback price fetch for ${symbol}`)
            const stockInfo = {
              token: stock.token,
              symbol: stock.symbol,
              exch_seg: stock.exchange || "NSE",
              instrumenttype: "EQ",
            }
            priceRanges = await marketDataService.getStockPriceRanges(freshAuthToken, stockInfo)
            console.log(`✅ Fallback price fetch successful for ${symbol}`)
          } catch (priceError) {
            console.error(`❌ Error fetching price data for fallback ${symbol}:`, priceError.message)

            // Try the direct market data approach as final fallback
            try {
              console.log(`📊 Trying final fallback - direct market data for ${symbol}`)
              const result = await marketDataService.fetchMarketData(freshAuthToken, "FULL")
              const stockData = result.data?.find(
                (item) => item.symbol?.toUpperCase() === symbol.toUpperCase() || item.token === stock.token,
              )

              if (stockData) {
                priceRanges = {
                  current: {
                    ltp: Number.parseFloat((stockData.ltp || 0).toFixed(2)),
                    change: Number.parseFloat((stockData.change || 0).toFixed(2)),
                    changePercent: Number.parseFloat((stockData.changePercent || 0).toFixed(2)),
                    volume: stockData.volume || 0,
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
                  },
                  metadata: {
                    symbol: stock.symbol,
                    token: stock.token,
                    exchange: stock.exchange,
                    lastUpdated: new Date().toISOString(),
                    dataSource: "final_fallback_market_data",
                  },
                }
                console.log(`✅ Final fallback successful for ${symbol}`)
              }
            } catch (finalError) {
              console.error(`❌ Final fallback also failed for ${symbol}:`, finalError.message)
            }
          }
        }

        res.json({
          success: true,
          data: {
            basic: stock,
            priceRanges: priceRanges,
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
          source: priceRanges ? "fallback_static_config_with_live_data" : "fallback_static_config_only",
          debugInfo: {
            authTokenAvailable: !!freshAuthToken,
            fallbackUsed: true,
            priceDataFetched: !!priceRanges,
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
