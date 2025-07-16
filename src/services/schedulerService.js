const cron = require("node-cron")
const authService = require("./authService")
const marketDataService = require("./marketDataService")
const { websocketService } = require("./websocketService")

class SchedulerService {
  constructor() {
    this.marketDataTask = null
    this.authCheckTask = null
    this.isMarketDataRunning = false
  }

  startMarketDataScheduler() {
    // Fetch market data every 30 seconds during market hours
    this.marketDataTask = cron.schedule(
      "*/30 * * * * *",
      async () => {
        await this.fetchAndBroadcastMarketData()
      },
      {
        scheduled: false,
      },
    )

    // Check authentication every 5 minutes
    this.authCheckTask = cron.schedule(
      "*/5 * * * *",
      async () => {
        await this.checkAuthentication()
      },
      {
        scheduled: false,
      },
    )

    // Start tasks
    this.marketDataTask.start()
    this.authCheckTask.start()

    console.log("⏰ Market data scheduler started")
    console.log("   📊 Market data: Every 30 seconds")
    console.log("   🔐 Auth check: Every 5 minutes")

    // Initial authentication and data fetch
    setTimeout(() => {
      this.initializeServices()
    }, 2000)
  }

  async initializeServices() {
    try {
      console.log("🚀 Initializing services...")

      // Authenticate first
      await authService.login()

      // Fetch initial market data
      await this.fetchAndBroadcastMarketData()

      console.log("✅ Services initialized successfully")
    } catch (error) {
      console.error("❌ Error initializing services:", error.message)
    }
  }

  async fetchAndBroadcastMarketData() {
    if (this.isMarketDataRunning) {
      console.log("⏳ Market data fetch already in progress, skipping...")
      return
    }

    try {
      this.isMarketDataRunning = true

      if (!authService.isAuthenticated()) {
        console.log("🔐 Not authenticated, attempting login...")
        await authService.login()
      }

      const authToken = authService.getAuthToken()

      // Fetch regular market data
      const result = await marketDataService.fetchMarketData(authToken, "FULL")

      if (result.success && result.data.length > 0) {
        websocketService.broadcastMarketData(result.data)
        console.log(`📡 Broadcasted ${result.data.length} market data updates`)
      }

      // Fetch option chain data for major underlyings
      const liveOptionChainService = require("./liveOptionChainService")
      const majorUnderlyings = ["NIFTY", "BANKNIFTY", "FINNIFTY"]

      for (const underlying of majorUnderlyings) {
        try {
          const optionResult = await liveOptionChainService.fetchLiveOptionChain(authToken, underlying)
          if (optionResult.success) {
            websocketService.broadcastOptionChainData(underlying, optionResult.data)
          }
        } catch (optionError) {
          console.error(`❌ Error fetching option chain for ${underlying}:`, optionError.message)
        }
      }
    } catch (error) {
      console.error("❌ Error in market data scheduler:", error.message)

      if (error.message.includes("401") || error.message.includes("unauthorized")) {
        console.log("🔐 Authentication expired, attempting re-login...")
        try {
          await authService.login()
        } catch (authError) {
          console.error("❌ Re-authentication failed:", authError.message)
        }
      }
    } finally {
      this.isMarketDataRunning = false
    }
  }

  async checkAuthentication() {
    try {
      if (!authService.isAuthenticated()) {
        console.log("🔐 Authentication check: Not authenticated, attempting login...")
        await authService.login()
      } else {
        const loginTime = authService.getLoginTime()
        const timeSinceLogin = Date.now() - loginTime.getTime()
        const hoursElapsed = timeSinceLogin / (1000 * 60 * 60)

        console.log(`🔐 Authentication check: Active (${hoursElapsed.toFixed(1)}h since login)`)

        // Re-authenticate if more than 8 hours
        if (hoursElapsed > 8) {
          console.log("🔐 Token expired, re-authenticating...")
          await authService.login()
        }
      }
    } catch (error) {
      console.error("❌ Error in authentication check:", error.message)
    }
  }

  stopScheduler() {
    if (this.marketDataTask) {
      this.marketDataTask.stop()
      console.log("⏹️ Market data scheduler stopped")
    }

    if (this.authCheckTask) {
      this.authCheckTask.stop()
      console.log("⏹️ Authentication scheduler stopped")
    }
  }

  getStatus() {
    return {
      marketDataRunning: this.marketDataTask ? this.marketDataTask.running : false,
      authCheckRunning: this.authCheckTask ? this.authCheckTask.running : false,
      isMarketDataFetching: this.isMarketDataRunning,
    }
  }
}

const schedulerService = new SchedulerService()

const startMarketDataScheduler = () => {
  schedulerService.startMarketDataScheduler()
}

module.exports = {
  schedulerService,
  startMarketDataScheduler,
}
