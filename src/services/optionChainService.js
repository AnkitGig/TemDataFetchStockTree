const liveOptionChainService = require("./liveOptionChainService")
const { getOptionUnderlyings, searchStocks } = require("../config/stockConfig")

class OptionChainService {
  constructor() {
    this.liveService = liveOptionChainService
  }

  async fetchOptionChainData(authToken, underlying) {
    // Always fetch fresh data from API
    return await this.liveService.fetchLiveOptionChain(authToken, underlying)
  }

  async getOptionChainByUnderlying(underlying, expiry = null) {
    // Check cache first, if not available return empty to trigger fresh fetch
    const cachedData = this.liveService.getLiveOptionChainFromCache(underlying)

    if (cachedData) {
      // Filter by expiry if specified
      if (expiry) {
        const filteredData = cachedData.filter((option) => option.expiry === expiry)
        return this.groupOptionsByStrike(filteredData)
      }
      return this.groupOptionsByStrike(cachedData)
    }

    // Return empty array to indicate no cached data available
    return []
  }

  // NEW: Get all options from cache without grouping
  async getAllOptionsFromCache(underlying) {
    const cachedData = this.liveService.getLiveOptionChainFromCache(underlying)
    return cachedData || []
  }

  groupOptionsByStrike(optionData) {
    // Group options by strike and expiry for better presentation
    const groupedData = {}

    optionData.forEach((option) => {
      const key = `${option.expiry}_${option.strike}`
      if (!groupedData[key]) {
        groupedData[key] = {
          strike: option.strike,
          expiry: option.expiry,
          underlying: option.underlying,
        }
      }
      groupedData[key][option.optionType] = option
    })

    return Object.values(groupedData)
  }

  async searchOptions(query, authToken = null) {
    try {
      // First search in static configuration
      const staticResults = searchStocks(query)

      // Then search for live option contracts if auth token is available
      const liveResults = authToken ? await this.liveService.searchLiveOptions(query, authToken) : []

      // Combine and deduplicate results
      const allResults = [...staticResults, ...liveResults]
      const uniqueResults = allResults.filter(
        (result, index, self) => index === self.findIndex((r) => r.symbol === result.symbol && r.type === result.type),
      )

      return uniqueResults.slice(0, 20)
    } catch (error) {
      console.error("❌ Error searching options:", error)
      return searchStocks(query) // Fallback to static search
    }
  }

  async getOptionsByExpiry(underlying, expiry) {
    const cachedData = this.liveService.getLiveOptionChainFromCache(underlying)

    if (cachedData) {
      return cachedData.filter((option) => option.expiry === expiry)
    }

    return []
  }

  getStats() {
    return this.liveService.getStats()
  }
}

module.exports = new OptionChainService()
