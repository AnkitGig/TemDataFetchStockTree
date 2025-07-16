const WebSocket = require("ws")
const marketDataService = require("./marketDataService")
const optionChainService = require("./optionChainService")

class WebSocketService {
  constructor() {
    this.wss = null
    this.clients = new Set()
    this.server = null
    this.subscriptions = new Map() // Track client subscriptions
  }

  initialize(server) {
    this.server = server

    // Create WebSocket server
    this.wss = new WebSocket.Server({
      server: server,
      path: "/ws",
    })

    this.wss.on("connection", (ws, request) => {
      console.log("👤 New WebSocket client connected")
      this.clients.add(ws)
      this.subscriptions.set(ws, new Set()) // Initialize subscriptions for this client

      // Send initial market data
      this.sendInitialData(ws)

      // Handle client messages
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message)
          this.handleClientMessage(ws, data)
        } catch (error) {
          console.error("❌ Error parsing client message:", error)
        }
      })

      // Handle client disconnect
      ws.on("close", () => {
        console.log("👤 WebSocket client disconnected")
        this.clients.delete(ws)
        this.subscriptions.delete(ws)
      })

      // Handle errors
      ws.on("error", (error) => {
        console.error("❌ WebSocket client error:", error)
        this.clients.delete(ws)
        this.subscriptions.delete(ws)
      })
    })

    console.log("🔌 WebSocket server initialized")
  }

  async sendInitialData(ws) {
    try {
      const latestData = await marketDataService.getLatestMarketData()

      const message = {
        type: "INITIAL_DATA",
        data: latestData,
        timestamp: new Date().toISOString(),
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      }
    } catch (error) {
      console.error("❌ Error sending initial data:", error)
    }
  }

  async handleClientMessage(ws, data) {
    switch (data.type) {
      case "PING":
        this.sendMessage(ws, { type: "PONG", timestamp: new Date().toISOString() })
        break

      case "SUBSCRIBE":
        await this.handleSubscription(ws, data.symbols, data.dataType || "EQUITY")
        break

      case "UNSUBSCRIBE":
        this.handleUnsubscription(ws, data.symbols)
        break

      case "SUBSCRIBE_OPTION_CHAIN":
        await this.handleOptionChainSubscription(ws, data.underlying)
        break

      case "SEARCH":
        await this.handleSearch(ws, data.query)
        break

      default:
        console.log("❓ Unknown message type:", data.type)
    }
  }

  async handleSubscription(ws, symbols, dataType) {
    const clientSubscriptions = this.subscriptions.get(ws)

    if (Array.isArray(symbols)) {
      symbols.forEach((symbol) => clientSubscriptions.add(`${dataType}:${symbol}`))
      console.log(`📊 Client subscribed to ${dataType}: ${symbols.join(", ")}`)
    }

    this.sendMessage(ws, {
      type: "SUBSCRIPTION_CONFIRMED",
      symbols: symbols,
      dataType: dataType,
      timestamp: new Date().toISOString(),
    })
  }

  handleUnsubscription(ws, symbols) {
    const clientSubscriptions = this.subscriptions.get(ws)

    if (Array.isArray(symbols)) {
      symbols.forEach((symbol) => {
        clientSubscriptions.delete(`EQUITY:${symbol}`)
        clientSubscriptions.delete(`OPTION:${symbol}`)
      })
      console.log(`📊 Client unsubscribed from: ${symbols.join(", ")}`)
    }
  }

  async handleOptionChainSubscription(ws, underlying) {
    try {
      const optionChain = await optionChainService.getOptionChainByUnderlying(underlying)

      this.sendMessage(ws, {
        type: "OPTION_CHAIN_DATA",
        underlying: underlying,
        data: optionChain,
        timestamp: new Date().toISOString(),
      })

      // Add to subscriptions
      const clientSubscriptions = this.subscriptions.get(ws)
      clientSubscriptions.add(`OPTION_CHAIN:${underlying}`)

      console.log(`📊 Client subscribed to option chain: ${underlying}`)
    } catch (error) {
      this.sendMessage(ws, {
        type: "ERROR",
        message: `Failed to get option chain for ${underlying}`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  async handleSearch(ws, query) {
    try {
      const authService = require("./authService")
      const authToken = authService.getAuthToken()

      const results = await optionChainService.searchOptions(query, authToken)

      this.sendMessage(ws, {
        type: "SEARCH_RESULTS",
        query: query,
        data: results,
        hasLiveData: !!authToken,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      this.sendMessage(ws, {
        type: "ERROR",
        message: `Search failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  broadcastMarketData(marketData) {
    const message = {
      type: "MARKET_UPDATE",
      data: marketData,
      timestamp: new Date().toISOString(),
    }

    this.broadcast(message)
  }

  broadcastOptionChainData(underlying, optionData) {
    const message = {
      type: "OPTION_CHAIN_UPDATE",
      underlying: underlying,
      data: optionData,
      timestamp: new Date().toISOString(),
    }

    // Only send to clients subscribed to this option chain
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const clientSubscriptions = this.subscriptions.get(client)
        if (clientSubscriptions && clientSubscriptions.has(`OPTION_CHAIN:${underlying}`)) {
          client.send(JSON.stringify(message))
        }
      }
    })

    console.log(`📡 Broadcasted option chain update for ${underlying}`)
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message)

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr)
      }
    })

    console.log(`📡 Broadcasted to ${this.clients.size} clients`)
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      isRunning: !!this.wss,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((total, subs) => total + subs.size, 0),
    }
  }
}

const websocketService = new WebSocketService()

const initializeWebSocketServer = (server) => {
  websocketService.initialize(server)
}

module.exports = {
  websocketService,
  initializeWebSocketServer,
}
