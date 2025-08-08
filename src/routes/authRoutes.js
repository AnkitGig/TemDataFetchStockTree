const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// POST /api/auth/login - Login to Angel Broking
router.post("/login", authController.login);

// GET /api/auth/status - Get authentication status
router.get("/status", authController.getStatus);

// POST /api/auth/logout - Logout
router.post("/logout", authController.logout);

// GET /api/auth/totp - Generate TOTP
router.get("/totp", authController.generateTOTP);

// GET /api/auth/test - Test authentication and API access
router.get("/test", async (req, res) => {
  try {
    const authService = require("../services/authService");
    
    // Force fresh login
    console.log("🔐 Testing authentication...");
    const loginResult = await authService.login();
    
    if (loginResult.success) {
      // Test a simple API call
      const marketDataService = require("../services/marketDataService");
      const testResult = await marketDataService.fetchMarketData(loginResult.authToken, "LTP", {
        NSE: ["3045"] // SBIN token
      });
      
      res.json({
        success: true,
        message: "Authentication and API test successful",
        loginResult: {
          authenticated: true,
          loginTime: loginResult.loginTime,
          tokenPreview: `${loginResult.authToken.substring(0, 20)}...`
        },
        apiTest: {
          success: testResult.success,
          dataReceived: testResult.data?.length || 0,
          sampleData: testResult.data?.[0] || null
        },
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error("Login failed");
    }
  } catch (error) {
    console.error("❌ Auth test failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Authentication test failed",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
