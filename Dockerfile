FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY config ./config
COPY database ./database
COPY src ./src
COPY public ./public
COPY jobs-ingest ./jobs-ingest

RUN npm run build
RUN npm prune --production

RUN mkdir -p .tmp

ENV NODE_ENV=production
EXPOSE 1337

CMD ["npm", "start"]
