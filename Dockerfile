FROM node:18-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source files
COPY tsconfig.json ./
COPY config ./config
COPY database ./database
COPY src ./src
COPY public ./public

# Build Strapi
RUN npm run build

# Production stage
FROM node:18-alpine

# Install runtime dependencies for native modules (pg, better-sqlite3, etc.)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/database ./database
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Create temp directory
RUN mkdir -p .tmp

# Set environment
ENV NODE_ENV=production

# Expose port (Railway sets PORT automatically)
EXPOSE 1337

# Start Strapi
CMD ["npm", "start"]

