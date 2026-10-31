# Backend API image for Cloud Run. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t sms-api .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Production dependencies only (Prisma CLI and tsx are included for migrations and seeding).
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace=apps/api --omit=dev && npm cache clean --force

# Compile the API.
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace=apps/api
COPY apps/api apps/api
RUN npm run build --workspace=apps/api

FROM base AS runtime
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PORT=8080
COPY --from=deps /app /app
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 8080
# The same image runs migrations / seeding as Cloud Run jobs:
#   npx prisma migrate deploy      npx tsx prisma/seed.ts
CMD ["node", "dist/main.js"]
