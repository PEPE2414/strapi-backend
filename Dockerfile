FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 1337

# Set NODE_ENV to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]

