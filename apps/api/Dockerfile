# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Use the lightweight Alpine variant of Node 20 to compile the project.
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root manifest files so npm can resolve the workspace graph.
COPY package.json package-lock.json* ./

# Copy only the packages needed to build the API, keeping the layer cache tight.
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install dependencies for the shared package and the API (with dev deps for build).
RUN npm install --workspace=packages/shared --workspace=apps/api

# Compile the shared types package first — the API depends on its output.
RUN npm run build --workspace=packages/shared

# Compile the API.
RUN npm run build --workspace=apps/api

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Start from a fresh Node 20 Alpine image so the final image contains no build
# tooling, source files, or dev dependencies.
FROM node:20-alpine AS runtime

WORKDIR /app

# Tell Node.js (and any libraries that check) we are running in production.
ENV NODE_ENV=production

# Copy only the compiled artefacts and their package manifests from the builder.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy the root manifest so npm can resolve the workspace dependency graph.
COPY --from=builder /app/package.json ./package.json

# Install only production dependencies (skip devDependencies).
RUN npm install --workspace=apps/api --omit=dev

# The API server listens on port 4000.
EXPOSE 4000

# Start the compiled API entry point.
CMD ["node", "apps/api/dist/index.js"]
