# Deployment Guide for Render

This guide will help you deploy the Angel Broking Live Market Data application to Render.

## Prerequisites

1. **GitHub Repository**: Push your code to a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **MongoDB Atlas**: Ensure your MongoDB Atlas cluster is accessible from anywhere (0.0.0.0/0)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your repository has the following structure:
\`\`\`
├── package.json (root)
├── server/
│   ├── package.json
│   └── server.js
├── client/
│   ├── package.json
│   └── src/
├── Dockerfile (optional)
└── render.yaml (optional)
\`\`\`

### 2. Create a New Web Service on Render

1. **Login to Render Dashboard**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Web Service"

2. **Connect Your Repository**
   - Choose "Build and deploy from a Git repository"
   - Connect your GitHub account
   - Select your repository

3. **Configure the Service**
   - **Name**: `angel-broking-app`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (uses root)
   - **Build Command**: `npm run install-all && npm run build`
   - **Start Command**: `npm start`

### 3. Set Environment Variables

In the Render dashboard, add these environment variables:

\`\`\`
NODE_ENV=production
CLIENT_CODE=RSIKA1012
MPIN=9993
SMARTAPI_KEY=a2syiZnn
TOTP_SECRET=AEY6BQA2HO3LJR4RPYOFWNIWK4
CLIENT_IP=192.168.1.1
PUBLIC_IP=103.21.58.192
MONGODB_URI=mongodb+srv://ankitchouhan7987:Y4blB8pgLqk5Qhlh@cluster0.4xqqdan.mongodb.net/authApi
\`\`\`

### 4. Advanced Settings (Optional)

- **Auto-Deploy**: Enable to automatically deploy on git push
- **Health Check Path**: `/api/auth/status`
- **Instance Type**: Free tier is sufficient for testing

### 5. Deploy

1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Build the React app
   - Start the Node.js server

### 6. Monitor Deployment

- Check the deployment logs in real-time
- Look for successful startup messages:
  \`\`\`
  🚀 Server running on port 10000
  📊 Connected to MongoDB
  🔌 WebSocket server running on port 10000
  \`\`\`

## Post-Deployment Configuration

### 1. Update MongoDB Network Access

Ensure your MongoDB Atlas cluster allows connections from Render:
- Go to MongoDB Atlas → Network Access
- Add IP Address: `0.0.0.0/0` (Allow access from anywhere)
- Or add Render's specific IP ranges

### 2. Test Your Application

1. **Access your app**: `https://your-app-name.onrender.com`
2. **Test API endpoints**:
   - `GET /api/auth/status`
   - `GET /api/market-data`
3. **Test WebSocket connection** in the Debug Info tab

### 3. Custom Domain (Optional)

- Go to Settings → Custom Domains
- Add your domain and configure DNS

## Troubleshooting

### Common Issues:

1. **Build Failures**
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json
   - Check build logs for specific errors

2. **Environment Variables**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure MongoDB URI is correct

3. **WebSocket Issues**
   - WebSocket uses the same port as HTTP in production
   - Check browser console for connection errors

4. **MongoDB Connection**
   - Verify network access settings
   - Check connection string format
   - Test connection from local environment

### Logs and Debugging:

- **View Logs**: Render Dashboard → Your Service → Logs
- **Health Checks**: Monitor the health check endpoint
- **Performance**: Check metrics in the dashboard

## Scaling and Optimization

### For Production Use:

1. **Upgrade Plan**: Consider paid plans for better performance
2. **Database Optimization**: Use MongoDB indexes
3. **Caching**: Implement Redis for session management
4. **Monitoring**: Set up alerts and monitoring
5. **SSL**: Render provides free SSL certificates

## Maintenance

### Regular Tasks:

1. **Monitor Logs**: Check for errors and performance issues
2. **Update Dependencies**: Keep packages up to date
3. **Database Maintenance**: Monitor MongoDB usage
4. **Backup**: Regular database backups
5. **Security**: Rotate API keys and secrets

## Support

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Community**: Render Community Forum
- **Support**: Contact Render support for technical issues

Your Angel Broking Live Market Data application is now deployed and ready for use!
