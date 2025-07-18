const axios = require("axios")
const { getTokensByExchange, getStockByToken, getOptionUnderlying } = require("../config/stockConfig")
const stockMasterService = require("./stockMasterService")

class MarketDataService {
  constructor() {
    this.baseUrl = "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/"
    this.lastFetchTime = null
    this.fetchCount = 0
    this.dataCache = new Map()
    this.cacheExpiry = 30 * 1000 // 30 seconds
  }

  async fetchMarketData(authToken, mode = "FULL", specificExchangeTokens = null) {
    // Added specificExchangeTokens parameter
    try {
      if (!authToken) {
        throw new Error("Authentication token required")
      }

      // Check cache first
      // Updated cache key to include specific tokens if provided, for better caching granularity
      const cacheKey = `market_data_${mode}_${specificExchangeTokens ? JSON.stringify(specificExchangeTokens) : "all"}`
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        console.log(`📊 Returning cached market data (${mode} mode)`)
        return {
          success: true,
          data: cached,
          fetchTime: new Date(),
          source: "cache",
        }
      }

      // Get enhanced token list from stock master service OR use specific tokens if provided
      const exchangeTokens = specificExchangeTokens || getTokensByExchange()

      const requestPayload = {
        mode: mode,
        exchangeTokens: exchangeTokens,
      }

      console.log(`📊 Fetching live market data (${mode} mode)...`)
      console.log(
        `📊 Token counts - NSE: ${exchangeTokens.NSE?.length || 0}, BSE: ${exchangeTokens.BSE?.length || 0}, NFO: ${exchangeTokens.NFO?.length || 0}`,
      )

      const response = await axios.post(this.baseUrl, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": process.env.CLIENT_IP || "192.168.1.1",
          "X-ClientPublicIP": process.env.PUBLIC_IP || "103.21.58.192",
          "X-MACAddress": "00:0a:95:9d:68:16",
          "X-PrivateKey": process.env.SMARTAPI_KEY,
        },
      })

      if (response.data && response.data.status) {
        const processedData = this.processMarketDataResponse(response.data)
        this.lastFetchTime = new Date()
        this.fetchCount++

        // Cache the result
        this.setCache(cacheKey, processedData)

        console.log(`✅ Live market data fetched successfully (${processedData.length} records)`)

        return {
          success: true,
          data: processedData,
          fetchTime: this.lastFetchTime,
          fetchCount: this.fetchCount,
          source: "live_api",
        }
      } else {
        throw new Error(`API Error: ${response.data?.message || "Unknown error"}`)
      }
    } catch (error) {
      console.error("❌ Error fetching market data:", error.message)
      throw error
    }
  }

  processMarketDataResponse(apiResponse) {
    try {
      const { fetched, unfetched } = apiResponse.data
      const processedData = []

      console.log(`📊 Processing ${fetched.length} fetched records`)

      if (unfetched.length > 0) {
        console.log(`⚠️ ${unfetched.length} unfetched records`)
      }

      for (const stockData of fetched) {
        const processedStock = this.processStockData(stockData)
        if (processedStock) {
          processedData.push(processedStock)
        }
      }

      return processedData
    } catch (error) {
      console.error("❌ Error processing market data response:", error)
      throw error
    }
  }

  processStockData(stockData) {
    try {
      // First try to get from enhanced stock config (which now includes stock master service)
      const stockConfig = getStockByToken(stockData.symbolToken)

      if (!stockConfig) {
        console.log(`⚠️ Unknown token: ${stockData.symbolToken}`)
        return null
      }

      // Return live data object without saving to database
      return {
        token: stockData.symbolToken,
        symbol: stockConfig.symbol,
        name: stockConfig.name || stockConfig.symbol,
        ltp: stockData.ltp || 0,
        change: stockData.netChange || 0,
        changePercent: stockData.percentChange || 0,
        open: stockData.open || 0,
        high: stockData.high || 0,
        low: stockData.low || 0,
        close: stockData.close || 0,
        volume: stockData.tradeVolume || 0,
        avgPrice: stockData.avgPrice || 0,
        upperCircuit: stockData.upperCircuit || 0,
        lowerCircuit: stockData.lowerCircuit || 0,
        weekHigh52: stockData["52WeekHigh"] || 0,
        weekLow52: stockData["52WeekLow"] || 0,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("❌ Error processing stock data:", error)
      return null
    }
  }

  async getUnderlyingPriceRanges(authToken, underlying) {
    try {
      if (!authToken) {
        throw new Error("Authentication token required")
      }

      console.log(`📊 Fetching comprehensive price ranges for ${underlying}`)

      // Get the underlying token from config
      const underlyingConfig = getOptionUnderlying(underlying)

      let stockInfo = null
      let targetExchange = "NSE" // Default exchange

      if (!underlyingConfig) {
        // Try to find in stock master service
        stockInfo = stockMasterService.getStockBySymbol(underlying)

        if (!stockInfo) {
          throw new Error(`Underlying ${underlying} not found in configuration or stock master.`)
        }
        targetExchange = stockInfo.exch_seg || "NSE" // Use exchange from stockMasterService if found
      } else {
        targetExchange = underlyingConfig.exchange || "NSE" // Use exchange from static config
      }

      const token = underlyingConfig ? underlyingConfig.token : stockInfo.token

      // Fetch current market data for the underlying
      const requestPayload = {
        mode: "FULL",
        exchangeTokens: {
          [targetExchange]: [token], // Use the determined targetExchange
        },
      }

      const response = await axios.post(this.baseUrl, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": process.env.CLIENT_IP || "192.168.1.1",
          "X-ClientPublicIP": process.env.PUBLIC_IP || "103.21.58.192",
          "X-MACAddress": "00:0a:95:9d:68:16",
          "X-PrivateKey": process.env.SMARTAPI_KEY,
        },
      })

      if (response.data && response.data.status && response.data.data.fetched.length > 0) {
        const underlyingData = response.data.data.fetched[0]

        // Calculate additional ranges (these would ideally come from historical data API)
        const currentPrice = underlyingData.ltp || 0
        const high52Week = underlyingData["52WeekHigh"] || 0
        const low52Week = underlyingData["52WeekLow"] || 0

        // For demo purposes, calculate estimated ranges based on current data
        // In production, you'd fetch this from historical data APIs
        const estimatedMonthlyHigh = Math.min(high52Week, currentPrice * 1.15)
        const estimatedMonthlyLow = Math.max(low52Week, currentPrice * 0.85)
        const estimatedWeeklyHigh = Math.min(estimatedMonthlyHigh, currentPrice * 1.08)
        const estimatedWeeklyLow = Math.max(estimatedMonthlyLow, currentPrice * 0.92)

        const priceRanges = {
          current: {
            ltp: Number.parseFloat((underlyingData.ltp || 0).toFixed(2)),
            change: Number.parseFloat((underlyingData.netChange || 0).toFixed(2)),
            changePercent: Number.parseFloat((underlyingData.percentChange || 0).toFixed(2)),
            volume: underlyingData.tradeVolume || 0,
            timestamp: new Date().toISOString(),
          },
          today: {
            open: Number.parseFloat((underlyingData.open || 0).toFixed(2)),
            high: Number.parseFloat((underlyingData.high || 0).toFixed(2)),
            low: Number.parseFloat((underlyingData.low || 0).toFixed(2)),
            close: Number.parseFloat((underlyingData.close || 0).toFixed(2)),
            volume: underlyingData.tradeVolume || 0,
          },
          weekly: {
            high: Number.parseFloat(estimatedWeeklyHigh.toFixed(2)),
            low: Number.parseFloat(estimatedWeeklyLow.toFixed(2)),
            changeFromWeekHigh: Number.parseFloat(
              (((currentPrice - estimatedWeeklyHigh) / estimatedWeeklyHigh) * 100).toFixed(2),
            ),
            changeFromWeekLow: Number.parseFloat(
              (((currentPrice - estimatedWeeklyLow) / estimatedWeeklyLow) * 100).toFixed(2),
            ),
          },
          monthly: {
            high: Number.parseFloat(estimatedMonthlyHigh.toFixed(2)),
            low: Number.parseFloat(estimatedMonthlyLow.toFixed(2)),
            changeFromMonthHigh: Number.parseFloat(
              (((currentPrice - estimatedMonthlyHigh) / estimatedMonthlyHigh) * 100).toFixed(2),
            ),
            changeFromMonthLow: Number.parseFloat(
              (((currentPrice - estimatedMonthlyLow) / estimatedMonthlyLow) * 100).toFixed(2),
            ),
          },
          yearly: {
            high52Week: Number.parseFloat(high52Week.toFixed(2)),
            low52Week: Number.parseFloat(low52Week.toFixed(2)),
            changeFrom52WeekHigh: Number.parseFloat((((currentPrice - high52Week) / high52Week) * 100).toFixed(2)),
            changeFrom52WeekLow: Number.parseFloat((((currentPrice - low52Week) / low52Week) * 100).toFixed(2)),
          },
          circuits: {
            upperCircuit: Number.parseFloat((underlyingData.upperCircuit || 0).toFixed(2)),
            lowerCircuit: Number.parseFloat((underlyingData.lowerCircuit || 0).toFixed(2)),
            distanceFromUpperCircuit: underlyingData.upperCircuit
              ? Number.parseFloat((((underlyingData.upperCircuit - currentPrice) / currentPrice) * 100).toFixed(2))
              : 0,
            distanceFromLowerCircuit: underlyingData.lowerCircuit
              ? Number.parseFloat((((currentPrice - underlyingData.lowerCircuit) / currentPrice) * 100).toFixed(2))
              : 0,
          },
          metadata: {
            symbol: underlying.toUpperCase(),
            token: token,
            exchange: targetExchange, // Use targetExchange here too
            lotSize: underlyingConfig?.lotSize || 1,
            lastUpdated: new Date().toISOString(),
            dataSource: "angel_broking_api",
          },
        }

        console.log(`✅ Fetched comprehensive price ranges for ${underlying}`)
        return priceRanges
      } else {
        throw new Error(`No data available for underlying ${underlying} on exchange ${targetExchange}`)
      }
    } catch (error) {
      console.error(`❌ Error fetching price ranges for ${underlying}:`, error.message)
      throw error
    }
  }

  async getLatestMarketData() {
    // Since we don't store in database, return empty array
    // This will trigger fresh fetch when needed
    return []
  }

  async getMarketDataBySymbol(symbol, limit = 100) {
    // Since we don't store in database, return empty array
    // This will trigger fresh fetch when needed
    return []
  }

  getFromCache(key) {
    const cached = this.dataCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data
    }
    return null
  }

  setCache(key, data) {
    this.dataCache.set(key, {
      data: data,
      timestamp: Date.now(),
    })
  }

  getStats() {
    return {
      lastFetchTime: this.lastFetchTime,
      fetchCount: this.fetchCount,
      cacheSize: this.dataCache.size,
      cacheExpiry: this.cacheExpiry,
      dataStorage: "memory_cache_only",
      enhancedStockMaster: true,
    }
  }
}

module.exports = new MarketDataService()
