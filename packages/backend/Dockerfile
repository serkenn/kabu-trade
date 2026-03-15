FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/prisma ./packages/shared/prisma/
RUN npm ci -w packages/shared -w packages/backend && \
    mkdir -p packages/shared/node_modules packages/backend/node_modules

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules/
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules/
COPY package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared/
COPY packages/backend ./packages/backend/
RUN npx -w packages/shared prisma generate
RUN npm -w packages/backend run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared ./packages/shared/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist/
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=deps /app/node_modules ./node_modules

USER appuser
EXPOSE 4000
ENV PORT=4000

CMD ["sh", "-c", "cd packages/shared && npx prisma db push --skip-generate && cd /app && node packages/backend/dist/index.js"]
