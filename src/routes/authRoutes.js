const express = require("express")
const router = express.Router()
const authController = require("../controllers/authController")

// POST /api/auth/login - Login to Angel Broking
router.post("/login", authController.login)

// GET /api/auth/status - Get authentication status
router.get("/status", authController.getStatus)

// POST /api/auth/logout - Logout
router.post("/logout", authController.logout)

// GET /api/auth/totp - Generate TOTP
router.get("/totp", authController.generateTOTP)

module.exports = router
