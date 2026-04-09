FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm install --workspace=packages/shared --workspace=apps/api

# Build shared types
RUN npm run build --workspace=packages/shared

# Build API
RUN npm run build --workspace=apps/api

# ---
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json ./package.json

RUN npm install --workspace=apps/api --omit=dev

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
