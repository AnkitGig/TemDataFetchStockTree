const axios = require("axios")
const { getTokensByExchange, getStockByToken } = require("../config/stockConfig")

class MarketDataService {
  constructor() {
    this.baseUrl = "https://apiconnect.angelone.in/rest/secure/angelbroking/market/v1/quote/"
    this.lastFetchTime = null
    this.fetchCount = 0
    this.dataCache = new Map()
    this.cacheExpiry = 30 * 1000 // 30 seconds
  }

  async fetchMarketData(authToken, mode = "FULL") {
    try {
      if (!authToken) {
        throw new Error("Authentication token required")
      }

      // Check cache first
      const cacheKey = `market_data_${mode}`
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

      // Get enhanced token list from stock master service
      const exchangeTokens = getTokensByExchange()

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
