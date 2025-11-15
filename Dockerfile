FROM node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY config ./config
COPY database ./database
COPY src ./src
COPY public ./public

# Build application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create temp directory
RUN mkdir -p .tmp

ENV NODE_ENV=production

EXPOSE 1337

CMD ["npm", "start"]

