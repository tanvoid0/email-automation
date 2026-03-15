# syntax=docker/dockerfile:1.7

# Use a multi-stage build for smaller images
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=true

# Install dependencies with pnpm
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
 && corepack prepare pnpm@latest --activate \
 && pnpm install --frozen-lockfile

# Build the Next.js application
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable \
 && corepack prepare pnpm@latest --activate \
 && pnpm run build

# Production runtime image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

# Copy only what is needed to run `next start`
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
# Note: Some projects don't have a `public/` folder. Skip copying it to avoid build errors.
# If your app uses public assets, ensure `public/` exists in the repo or add a copy step.
COPY package.json ./

EXPOSE 3000
USER nodeuser

# Use Node to execute Next.js CLI directly (no need to have pnpm at runtime)
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
