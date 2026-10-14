FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for layer caching (postinstall runs `prisma generate`, which needs the schema)
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY prisma ./prisma
COPY lib ./lib
RUN npm ci --include=dev && npm cache clean --force

COPY . .
RUN chmod +x docker-entrypoint.sh && mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
