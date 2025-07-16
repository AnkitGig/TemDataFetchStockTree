const authService = require("../services/authService")

const login = async (req, res) => {
  try {
    const result = await authService.login()

    res.json({
      success: true,
      message: "Authentication successful",
      loginTime: result.loginTime,
      authToken: result.authToken.substring(0, 20) + "...",
      feedToken: result.feedToken.substring(0, 20) + "...",
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    })
  }
}

const getStatus = async (req, res) => {
  try {
    const isAuthenticated = authService.isAuthenticated()
    const loginTime = authService.getLoginTime()

    res.json({
      success: true,
      status: {
        authenticated: isAuthenticated,
        loginTime: loginTime,
        hasAuthToken: !!authService.getAuthToken(),
        hasFeedToken: !!authService.getFeedToken(),
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const logout = async (req, res) => {
  try {
    authService.logout()

    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

const generateTOTP = async (req, res) => {
  try {
    const totp = authService.generateTOTP()

    res.json({
      success: true,
      totp: totp,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = {
  login,
  getStatus,
  logout,
  generateTOTP,
}
