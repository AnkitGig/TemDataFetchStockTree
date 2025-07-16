const mongoose = require("mongoose")

const marketDataSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      index: true,
    },
    ltp: {
      type: Number,
      default: 0,
    },
    change: {
      type: Number,
      default: 0,
    },
    changePercent: {
      type: Number,
      default: 0,
    },
    open: {
      type: Number,
      default: 0,
    },
    high: {
      type: Number,
      default: 0,
    },
    low: {
      type: Number,
      default: 0,
    },
    close: {
      type: Number,
      default: 0,
    },
    volume: {
      type: Number,
      default: 0,
    },
    avgPrice: {
      type: Number,
      default: 0,
    },
    upperCircuit: {
      type: Number,
      default: 0,
    },
    lowerCircuit: {
      type: Number,
      default: 0,
    },
    weekHigh52: {
      type: Number,
      default: 0,
    },
    weekLow52: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for efficient queries
marketDataSchema.index({ symbol: 1, timestamp: -1 })
marketDataSchema.index({ token: 1, timestamp: -1 })

module.exports = mongoose.model("MarketData", marketDataSchema)
