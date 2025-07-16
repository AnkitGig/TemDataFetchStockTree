// // liveMarketStreamer.js
// const { websocketService } = require("./src/services/websocketService");
// const marketDataService = require("./src/services/marketDataService");

// function startMarketBroadcastLoop() {
//   setInterval(async () => {
//     try {
//       const latestData = await marketDataService.getLatestMarketData();
//       websocketService.broadcastMarketData(latestData);
//       console.log("✅ Broadcasted market data at", new Date().toISOString());
//     } catch (error) {
//       console.error("❌ Error during market broadcast:", error.message);
//     }
//   }, 1000); // every 1 second
// }

// module.exports = { startMarketBroadcastLoop };


const { websocketService } = require("./src/services/websocketService");
const marketDataService = require("./src/services/marketDataService");
const authService = require("./src/services/authService"); 

async function startMarketBroadcastLoop() {
  setInterval(async () => {
    try {
      const authToken = authService.getAuthToken(); // 🔐 Get current login token

      if (!authToken) {
        console.warn("⚠️ No auth token available. Skipping broadcast.");
        return;
      }

      const result = await marketDataService.fetchMarketData(authToken, "FULL");

      if (result.success) {
        websocketService.broadcastMarketData(result.data); // 📡 Broadcast fetched data
        console.log("✅ Live market data broadcasted directly from API");
      } else {
        console.warn("⚠️ Failed to fetch live market data:", result);
      }
    } catch (error) {
      console.error("❌ Broadcast error:", error.message);
    }
  }, 1000); // every 1 second
}

module.exports = { startMarketBroadcastLoop };
