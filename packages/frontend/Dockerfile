FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/prisma ./packages/shared/prisma/
RUN npm ci -w packages/shared -w packages/frontend && \
    mkdir -p packages/shared/node_modules packages/frontend/node_modules

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules/
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules/
COPY package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared/
COPY packages/frontend ./packages/frontend/
RUN mkdir -p packages/frontend/public
# Build shared first so dist/index.js exists
RUN npx tsc -p packages/shared/tsconfig.json
ENV BACKEND_URL=http://backend:4000
RUN cd packages/frontend && npx next build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# standalone output preserves monorepo structure
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public
COPY --from=builder /app/packages/frontend/.next/standalone ./
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/frontend/server.js"]
