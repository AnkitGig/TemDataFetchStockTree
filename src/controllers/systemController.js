const { websocketService } = require("../services/websocketService")
const { schedulerService } = require("../services/schedulerService")
const authService = require("../services/authService")
const marketDataService = require("../services/marketDataService")

const getSystemStatus = async (req, res) => {
  try {
    const wsStats = websocketService.getStats()
    const schedulerStats = schedulerService.getStatus()
    const marketStats = marketDataService.getStats()

    res.json({
      success: true,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
      authentication: {
        authenticated: authService.isAuthenticated(),
        loginTime: authService.getLoginTime(),
      },
      websocket: wsStats,
      scheduler: schedulerStats,
      marketData: marketStats,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const getHealthCheck = async (req, res) => {
  try {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: "Angel Broking Backend is running",
    })
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    })
  }
}

module.exports = {
  getSystemStatus,
  getHealthCheck,
}
