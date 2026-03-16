FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/admin/package.json ./packages/admin/
COPY packages/shared/prisma ./packages/shared/prisma/
RUN npm ci -w packages/shared -w packages/admin && \
    mkdir -p packages/shared/node_modules packages/admin/node_modules

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules/
COPY --from=deps /app/packages/admin/node_modules ./packages/admin/node_modules/
COPY package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared/
COPY packages/admin ./packages/admin/
RUN mkdir -p packages/admin/public
# Build shared first so dist/index.js exists
RUN npx tsc -p packages/shared/tsconfig.json
ENV BACKEND_URL=http://backend:4000
RUN cd packages/admin && npx next build
# Debug: show standalone output structure
RUN echo "=== standalone root ===" && ls packages/admin/.next/standalone/ && \
    echo "=== standalone/packages ===" && ls packages/admin/.next/standalone/packages/ 2>/dev/null || true && \
    echo "=== looking for server.js ===" && find packages/admin/.next/standalone -name "server.js" -type f 2>/dev/null || true

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output (outputFileTracingRoot preserves monorepo structure)
COPY --from=builder /app/packages/admin/.next/standalone ./
COPY --from=builder /app/packages/admin/public ./packages/admin/public
COPY --from=builder /app/packages/admin/.next/static ./packages/admin/.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/admin/server.js"]
