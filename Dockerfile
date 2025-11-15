FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Try npm ci first (faster, reproducible), fall back to npm install if lock file is out of sync
RUN npm ci || npm install

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source files
COPY config ./config
COPY database ./database
COPY src ./src
COPY public ./public
COPY jobs-ingest ./jobs-ingest

# Build the application
RUN npm run build || (echo "Build failed, checking for errors..." && exit 1)

# Remove dev dependencies
RUN npm prune --production

# Create necessary directories
RUN mkdir -p .tmp .cache

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 1337

# Start the application
CMD ["npm", "start"]
