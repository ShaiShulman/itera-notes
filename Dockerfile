
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install sqlite dependencies and build tools
RUN apk add --no-cache openssl sqlite python3 make g++

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies including dev dependencies for build
RUN npm ci --ignore-scripts

# Rebuild native modules for the current platform
RUN npm rebuild better-sqlite3

# Install Prisma CLI for running migrations
RUN npm install prisma --save-dev

COPY prisma ./prisma/
COPY prisma/migrations ./prisma/migrations/

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install build tools in builder stage too
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Rebuild native modules for the current platform
RUN npm rebuild better-sqlite3

ENV PRISMA_CLIENT_ENGINE_TYPE=binary
RUN npx prisma generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache openssl sqlite

# Install Prisma CLI in runtime to run migrations
RUN npm install -g prisma@6.13.0

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Create logs directory and set proper permissions
RUN mkdir -p /app/logs
RUN chown nextjs:nodejs /app/logs

# Create database directory and set proper permissions
RUN mkdir -p /app/data
RUN chmod 777 /app/data
RUN chown nextjs:nodejs /app/data

# Create cache directory with full permissions for app to create subdirectories
RUN mkdir -p /app/.cache
RUN chown -R nextjs:nodejs /app/.cache
RUN chmod -R 755 /app/.cache

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations/
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
ENV DATABASE_URL="file:/app/data/dev.db"

USER nextjs

# Ensure database directory and file are writable by runtime user
RUN chmod -R u+rwX,g+rwX /app/data || true

EXPOSE 3000

# Create volumes for logs and database persistence
VOLUME ["/app/logs", "/app/data", "/app/.cache"]

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]