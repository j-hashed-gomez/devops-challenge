# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN corepack enable && \
    corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile --prod

# Stage 2: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and all dependencies (including dev)
RUN corepack enable && \
    corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN pnpm run build

# Stage 3: Production runtime with distroless
FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app

# Copy node_modules from deps stage (production only)
COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist

# Copy package.json for runtime metadata
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./

# Distroless images run as non-root by default (uid 65532)
# No need to explicitly set USER as it's already nonroot

# Expose application port
EXPOSE 3000

# Health check metadata (will be used by Docker Compose and K8s)
ENV NODE_ENV=production

# Start the application
CMD ["dist/main.js"]
