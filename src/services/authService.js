const axios = require("axios")
const speakeasy = require("speakeasy")

class AuthService {
  constructor() {
    this.authToken = null
    this.feedToken = null
    this.loginTime = null
    this.baseUrl = "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1"
  }

  generateTOTP() {
    try {
      if (!process.env.TOTP_SECRET) {
        throw new Error("TOTP_SECRET not configured")
      }

      return speakeasy.totp({
        secret: process.env.TOTP_SECRET,
        encoding: "base32",
      })
    } catch (error) {
      console.error("❌ Error generating TOTP:", error.message)
      throw error
    }
  }

  async login() {
    try {
      // Check if we already have a valid token
      if (this.authToken && this.isTokenValid()) {
        console.log("✅ Using existing valid auth token");
        return {
          success: true,
          authToken: this.authToken,
          feedToken: this.feedToken,
          loginTime: this.loginTime,
        };
      }

      const currentTOTP = this.generateTOTP()
      console.log(`🔐 Generated TOTP: ${currentTOTP}`);

      const loginPayload = {
        clientcode: process.env.CLIENT_CODE,
        password: process.env.MPIN,
        totp: currentTOTP,
      }

      const config = {
        method: "post",
        url: `${this.baseUrl}/loginByPassword`,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": process.env.CLIENT_IP || "192.168.1.1",
          "X-ClientPublicIP": process.env.PUBLIC_IP || "103.21.58.192",
          "X-MACAddress": "00:0a:95:9d:68:16",
          "X-PrivateKey": process.env.SMARTAPI_KEY,
        },
        data: loginPayload,
        timeout: 10000, // 10 second timeout
      }

      console.log("🔐 Attempting login to Angel Broking...")
      console.log(`🔐 Client Code: ${process.env.CLIENT_CODE}`);
      console.log(`🔐 API Key: ${process.env.SMARTAPI_KEY?.substring(0, 8)}...`);

      const response = await axios(config)

      if (response.data && response.data.status === true) {
        this.authToken = response.data.data.jwtToken
        this.feedToken = response.data.data.feedToken
        this.loginTime = new Date()

        console.log("✅ Successfully authenticated with Angel Broking")
        console.log(`📊 Auth Token: ${this.authToken.substring(0, 20)}...`)
        console.log(`📊 Feed Token: ${this.feedToken.substring(0, 20)}...`)

        return {
          success: true,
          authToken: this.authToken,
          feedToken: this.feedToken,
          loginTime: this.loginTime,
        }
      } else {
        throw new Error(`Login failed: ${response.data?.message || "Unknown error"}`)
      }
    } catch (error) {
      console.error("❌ Authentication failed:", error.message)
      if (error.response) {
        console.error("📋 Error status:", error.response.status)
        console.error("📋 Error data:", JSON.stringify(error.response.data, null, 2))
      }
      
      // Clear invalid tokens
      this.authToken = null;
      this.feedToken = null;
      this.loginTime = null;
      
      throw error
    }
  }

  getAuthToken() {
    return this.authToken
  }

  getFeedToken() {
    return this.feedToken
  }

  isAuthenticated() {
    return !!this.authToken
  }

  getLoginTime() {
    return this.loginTime
  }

  logout() {
    this.authToken = null
    this.feedToken = null
    this.loginTime = null
    console.log("🔓 Logged out from Angel Broking")
  }

  isTokenValid() {
    if (!this.authToken || !this.loginTime) return false;
    
    // Check if token is less than 8 hours old
    const hoursElapsed = (Date.now() - this.loginTime.getTime()) / (1000 * 60 * 60);
    return hoursElapsed < 8;
  }
}

module.exports = new AuthService()
