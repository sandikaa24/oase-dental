# ─── STAGE 1: Base Image & Package Manager ───
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

# ─── STAGE 2: Install Dependencies ───
FROM base AS deps
WORKDIR /app

# Salin file konfigurasi workspace & lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/web/prisma ./apps/web/prisma/

# Install seluruh dependency monorepo secara deterministik
RUN pnpm install --frozen-lockfile

# ─── STAGE 3: Build Standalone Next.js ───
FROM base AS builder
WORKDIR /app

COPY --from=deps /app ./

# Salin source code
COPY . .

# Generate Prisma Client
RUN pnpm --filter @oase/web exec prisma generate --schema prisma/schema.prisma

# Build production dengan output standalone (Linux environment)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @oase/web build

# ─── STAGE 4: Production Runner (Non-Root) ───
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV UPLOAD_DIR=/app/uploads/expense-proofs

# Buat grup dan user non-root untuk keamanan kontainer
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Siapkan direktori storage upload persisten dengan kepemilikan non-root
RUN mkdir -p /app/uploads/expense-proofs && chown -R nextjs:nodejs /app/uploads

# Salin aset publik dan output standalone Next.js
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
