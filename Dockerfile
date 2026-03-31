FROM node:20-slim AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./

# Copy only the packages needed for the build
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY demo/package.json demo/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY packages/core/ packages/core/
COPY packages/server/ packages/server/
COPY demo/ demo/

# Build core first (server depends on it), then server
RUN npm run build

# Build the frontend demo (Vite → static files in demo/dist/)
RUN npm run build --workspace=demo

# --- Server production image ---
FROM node:20-slim AS server

WORKDIR /app

COPY --from=builder /app/packages/server/dist/ ./dist/
COPY --from=builder /app/packages/server/package.json ./

RUN npm install --omit=dev

EXPOSE 4321

CMD ["node", "dist/cli.js"]

# --- Frontend nginx image ---
FROM nginx:alpine AS frontend

COPY --from=builder /app/demo/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
