# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm run install-all

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
