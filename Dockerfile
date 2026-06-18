# Image de l'application Flappy TBAN (serveur Node + jeu statique servi par Express)
FROM node:20-alpine

WORKDIR /app

# 1) Dépendances d'abord (meilleur cache Docker)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# 2) Code applicatif
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck Docker (en complément du Healthcheck Coolify)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/server.js"]
