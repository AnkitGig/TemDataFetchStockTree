# Angel Broking Real-Time Market Data Backend

A production-ready Node.js backend service that provides real-time market data from Angel Broking SmartAPI with WebSocket support for live updates.

## 🚀 Features

- **Real-Time Market Data**: Fetch live stock prices from Angel Broking SmartAPI
- **WebSocket Support**: Real-time data streaming to connected clients
- **Automated Scheduling**: Automatic data fetching every 30 seconds during market hours
- **MongoDB Integration**: Persistent storage of market data
- **RESTful API**: Clean API endpoints for data access
- **Authentication Management**: Automatic token management and renewal
- **Error Handling**: Comprehensive error handling and logging
- **Production Ready**: Optimized for deployment on cloud platforms

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Angel Broking account with API access

## 🛠️ Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd angel-broking-backend
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure environment variables**
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   
   Edit `.env` with your Angel Broking credentials:
   \`\`\`env
   CLIENT_CODE=your_client_code
   MPIN=your_mpin
   SMARTAPI_KEY=your_api_key
   TOTP_SECRET=your_totp_secret
   MONGODB_URI=your_mongodb_connection_string
   \`\`\`

4. **Start the server**
   \`\`\`bash
   # Development
   npm run dev
   
   # Production
   npm start
   \`\`\`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login to Angel Broking
- `GET /api/auth/status` - Get authentication status
- `GET /api/auth/totp` - Generate TOTP code
- `POST /api/auth/logout` - Logout

### Market Data
- `GET /api/market-data` - Get all market data
- `GET /api/market-data/latest` - Get latest prices for all symbols
- `GET /api/market-data/symbol/:symbol` - Get data for specific symbol
- `GET /api/market-data/stats` - Get market data statistics
- `POST /api/market-data/fetch` - Manually fetch fresh data

### System
- `GET /api/system/status` - Get system status
- `GET /api/system/health` - Health check endpoint

### WebSocket
- `ws://localhost:3001/ws` - WebSocket connection for real-time updates

## 🔌 WebSocket Usage

Connect to the WebSocket endpoint to receive real-time market data updates:

\`\`\`javascript
const ws = new WebSocket('ws://localhost:3001/ws')

ws.onopen = () => {
  console.log('Connected to market data stream')
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch(data.type) {
    case 'INITIAL_DATA':
      console.log('Initial market data:', data.data)
      break
    case 'MARKET_UPDATE':
      console.log('Market update:', data.data)
      break
  }
}
\`\`\`

## 📊 Data Structure

Market data objects contain the following fields:

\`\`\`javascript
{
  "_id": "ObjectId",
  "token": "3045",
  "symbol": "SBIN",
  "ltp": 417.15,
  "change": 0.05,
  "changePercent": 0.01,
  "open": 417.15,
  "high": 419.0,
  "low": 415.95,
  "close": 416.0,
  "volume": 1000000,
  "avgPrice": 417.5,
  "upperCircuit": 458.85,
  "lowerCircuit": 375.45,
  "weekHigh52": 629.55,
  "weekLow52": 430.7,
  "timestamp": "2025-06-05T06:57:17.699Z"
}
\`\`\`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLIENT_CODE` | Angel Broking client code | Yes |
| `MPIN` | Angel Broking MPIN | Yes |
| `SMARTAPI_KEY` | Angel Broking API key | Yes |
| `TOTP_SECRET` | TOTP secret for 2FA | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |

### Stock Configuration

Edit `src/config/stockConfig.js` to modify the list of stocks to monitor:

\`\`\`javascript
const STOCK_CONFIG = {
  NSE: [
    { token: '3045', symbol: 'SBIN' },
    { token: '881', symbol: 'RELIANCE' },
    // Add more stocks...
  ],
  NFO: [
    { token: '58662', symbol: 'NIFTY_JUN_FUT' }
    // Add more futures/options...
  ]
}
\`\`\`

## 🚀 Deployment

### Docker Deployment

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
\`\`\`

### Cloud Deployment

The application is ready for deployment on:
- Heroku
- Render
- AWS
- Google Cloud Platform
- DigitalOcean

## 📈 Monitoring

The service includes built-in monitoring endpoints:

- **Health Check**: `GET /api/system/health`
- **System Status**: `GET /api/system/status`
- **Market Stats**: `GET /api/market-data/stats`

## 🔧 Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify Angel Broking credentials
   - Check TOTP secret configuration
   - Ensure API key is active

2. **Database Connection**
   - Verify MongoDB URI
   - Check network connectivity
   - Ensure database permissions

3. **Market Data Issues**
   - Check market hours (9:15 AM - 3:30 PM IST)
   - Verify stock tokens are correct
   - Check Angel Broking API status

### Logs

The application provides detailed logging:
- Authentication events
- Market data fetching
- WebSocket connections
- Error messages

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the logs for error details
#   s t o c k _ n e w  
 #   T e m D a t a F e t c h S t o c k T r e e  
 