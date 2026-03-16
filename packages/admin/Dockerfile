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
RUN npx tsc -p packages/shared/tsconfig.json
ENV BACKEND_URL=http://backend:4000
RUN cd packages/admin && npx next build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist/

# Copy Next.js build output
COPY --from=builder /app/packages/admin/package.json ./packages/admin/
COPY --from=builder /app/packages/admin/next.config.mjs ./packages/admin/
COPY --from=builder /app/packages/admin/.next ./packages/admin/.next
COPY --from=builder /app/packages/admin/public ./packages/admin/public

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node_modules/.bin/next", "start", "packages/admin", "-p", "3001"]
