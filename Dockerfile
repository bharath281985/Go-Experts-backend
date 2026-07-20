# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Run Stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/modules/developer/*.json ./dist/modules/developer/

EXPOSE 5001
CMD ["node", "dist/server.js"]
