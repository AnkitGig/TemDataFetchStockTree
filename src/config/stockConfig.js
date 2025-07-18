const STOCK_CONFIG = {
  NSE: [
    { token: "3045", symbol: "SBIN", name: "State Bank of India" },
    { token: "881", symbol: "RELIANCE", name: "Reliance Industries Ltd" },
    { token: "99926004", symbol: "INFY", name: "Infosys Ltd" },
    { token: "2885", symbol: "TCS", name: "Tata Consultancy Services" },
    { token: "1333", symbol: "HDFCBANK", name: "HDFC Bank Ltd" },
    { token: "17963", symbol: "ITC", name: "ITC Ltd" },
    { token: "11536", symbol: "LT", name: "Larsen & Toubro Ltd" },
    { token: "1660", symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
    { token: "288", symbol: "AXISBANK", name: "Axis Bank Ltd" },
    { token: "5633", symbol: "MARUTI", name: "Maruti Suzuki India Ltd" },
    { token: "1594", symbol: "ICICIBANK", name: "ICICI Bank Ltd" },
    { token: "10999", symbol: "BHARTIARTL", name: "Bharti Airtel Ltd" },
    { token: "526", symbol: "BAJFINANCE", name: "Bajaj Finance Ltd" },
    { token: "16675", symbol: "ASIANPAINT", name: "Asian Paints Ltd" },
    { token: "1330", symbol: "HDFC", name: "Housing Development Finance Corporation Ltd" },
  ],
  NFO: [{ token: "58662", symbol: "NIFTY_JUN_FUT", name: "Nifty June Future" }],

  // Option-enabled underlyings - these support option chains
  OPTION_UNDERLYINGS: {
    NIFTY: { token: "99926000", name: "Nifty 50", lotSize: 25, exchange: "NFO" },
    BANKNIFTY: { token: "99926009", name: "Bank Nifty", lotSize: 15, exchange: "NFO" },
    FINNIFTY: { token: "99926037", name: "Fin Nifty", lotSize: 40, exchange: "NFO" },
    RELIANCE: { token: "881", name: "Reliance Industries", lotSize: 250, exchange: "NFO" },
    TCS: { token: "2885", name: "Tata Consultancy Services", lotSize: 125, exchange: "NFO" },
    HDFCBANK: { token: "1333", name: "HDFC Bank", lotSize: 550, exchange: "NFO" },
    ICICIBANK: { token: "1594", name: "ICICI Bank", lotSize: 1375, exchange: "NFO" },
    INFY: { token: "99926004", name: "Infosys", lotSize: 300, exchange: "NFO" },
    ITC: { token: "17963", name: "ITC", lotSize: 3200, exchange: "NFO" },
    SBIN: { token: "3045", name: "State Bank of India", lotSize: 1500, exchange: "NFO" },
  },
}

const getAllStocks = () => {
  return [...STOCK_CONFIG.NSE, ...STOCK_CONFIG.NFO]
}

const getOptionUnderlyings = () => {
  return Object.keys(STOCK_CONFIG.OPTION_UNDERLYINGS).map((symbol) => ({
    symbol,
    ...STOCK_CONFIG.OPTION_UNDERLYINGS[symbol],
    type: "OPTION_UNDERLYING",
  }))
}

const getOptionUnderlying = (symbol) => {
  return STOCK_CONFIG.OPTION_UNDERLYINGS[symbol.toUpperCase()] || null
}

const getStockByToken = (token) => {
  // First check static config
  const allStocks = getAllStocks()
  const staticStock = allStocks.find((stock) => stock.token === token)

  if (staticStock) {
    return staticStock
  }

  // If not found in static config, try stock master service
  try {
    const stockMasterService = require("../services/stockMasterService")
    const dynamicStock = stockMasterService.getStockByToken(token)

    if (dynamicStock) {
      return {
        token: dynamicStock.token,
        symbol: dynamicStock.symbol,
        name: dynamicStock.name || dynamicStock.symbol,
      }
    }
  } catch (error) {
    console.error("Error accessing stock master service:", error.message)
  }

  return null
}

const searchStocks = (query) => {
  if (!query || query.length < 2) return []

  // Use stock master service for comprehensive search
  try {
    const stockMasterService = require("../services/stockMasterService")
    return stockMasterService.searchStocks(query, {
      limit: 20,
      exchanges: ["NSE", "BSE", "NFO"],
      instrumentTypes: ["EQ", "OPTIDX", "OPTSTK", "FUTIDX", "FUTSTK"],
    })
  } catch (error) {
    console.error("Error using stock master service, falling back to static search:", error.message)

    // Fallback to static search
    const searchTerm = query.toLowerCase()
    const results = []

    // Search in NSE stocks
    STOCK_CONFIG.NSE.forEach((stock) => {
      if (stock.symbol.toLowerCase().includes(searchTerm) || stock.name.toLowerCase().includes(searchTerm)) {
        results.push({
          ...stock,
          type: "EQUITY",
          exchange: "NSE",
        })
      }
    })

    // Search in Option Underlyings
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
        })
      }
    })

    return results.slice(0, 20)
  }
}

const getTokensByExchange = () => {
  // Get tokens from static config
  const staticTokens = {
    NSE: STOCK_CONFIG.NSE.map((stock) => stock.token),
    NFO: STOCK_CONFIG.NFO.map((stock) => stock.token),
  }

  // Try to enhance with stock master service
  try {
    const stockMasterService = require("../services/stockMasterService")
    const enhancedTokens = stockMasterService.getMarketDataTokens()

    return {
      NSE: [...new Set([...staticTokens.NSE, ...enhancedTokens.NSE])], // Remove duplicates
      NFO: [...new Set([...staticTokens.NFO, ...enhancedTokens.NFO])],
      BSE: enhancedTokens.BSE || [],
    }
  } catch (error) {
    console.error("Error accessing stock master service for tokens:", error.message)
    return staticTokens
  }
}

module.exports = {
  STOCK_CONFIG,
  getAllStocks,
  getOptionUnderlyings,
  getOptionUnderlying,
  getStockByToken,


  searchStocks,
  getTokensByExchange,
}
