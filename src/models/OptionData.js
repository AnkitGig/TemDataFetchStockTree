const mongoose = require("mongoose")

const optionDataSchema = new mongoose.Schema(
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
    underlying: {
      type: String,
      required: true,
      index: true,
    },
    strike: {
      type: Number,
      required: true,
    },
    optionType: {
      type: String,
      enum: ["CE", "PE"],
      required: true,
    },
    expiry: {
      type: String,
      required: true,
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
    openInterest: {
      type: Number,
      default: 0,
    },
    impliedVolatility: {
      type: Number,
      default: 0,
    },
    delta: {
      type: Number,
      default: 0,
    },
    gamma: {
      type: Number,
      default: 0,
    },
    theta: {
      type: Number,
      default: 0,
    },
    vega: {
      type: Number,
      default: 0,
    },
    lotSize: {
      type: Number,
      default: 1,
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

// Compound indexes for efficient queries
optionDataSchema.index({ underlying: 1, expiry: 1, strike: 1 })
optionDataSchema.index({ symbol: 1, timestamp: -1 })
optionDataSchema.index({ underlying: 1, timestamp: -1 })
optionDataSchema.index({ strike: 1, optionType: 1 })

module.exports = mongoose.model("OptionData", optionDataSchema)
