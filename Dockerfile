FROM node:20-alpine AS base
WORKDIR /app

# Build backend
FROM base AS backend-builder
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Build frontend
FROM base AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# Production image
FROM base AS production
ENV NODE_ENV=production

# Copy backend artifacts
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-builder /app/dist ./dist

# Copy frontend build into the location Express serves it from
COPY --from=frontend-builder /app/client/dist ./client/dist

# Data directory for SQLite
RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 3000

CMD ["node", "dist/app.js"]
