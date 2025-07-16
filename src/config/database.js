const mongoose = require("mongoose")

const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/angelbroking"

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    console.log("📊 Connected to MongoDB successfully")

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error)
    })

    mongoose.connection.on("disconnected", () => {
      console.log("🔌 MongoDB disconnected")
    })
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error)
    process.exit(1)
  }
}

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect()
    console.log("✅ Disconnected from MongoDB")
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error)
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
}
