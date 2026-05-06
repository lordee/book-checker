FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
# Skip downloading Chromium for Puppeteer as it's not used at runtime, speeding up the build
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure files/directories needed at runtime exist so they can be copied
RUN mkdir -p public/book-covers custom-lists saved-searches && touch library-config.md

# Next.js collects completely anonymous telemetry data about general usage.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for directories that will be written to at runtime
RUN mkdir -p .next public/book-covers custom-lists saved-searches

# Copy static files and configure ownership
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/library-config.md ./library-config.md

# Ensure proper permissions for runtime-generated files
RUN chown -R nextjs:nodejs .next public custom-lists saved-searches library-config.md

# Install su-exec for dropping privileges in entrypoint
RUN apk add --no-cache su-exec

COPY run.sh /app/run.sh
RUN chmod +x /app/run.sh

# We run as root initially to set up persistent volume symlinks in run.sh,
# and drop to nextjs user before running node.
# USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# Use run.sh to setup persistent data and start server
CMD ["/app/run.sh"]
