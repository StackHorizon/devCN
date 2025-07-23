# Dockerfile per il server principale devCN
FROM node:18-alpine

# Installa Docker client per gestire i container
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copia package.json e installa dipendenze
COPY package*.json ./
RUN npm ci --only=production

# Copia il codice dell'applicazione
COPY . .

# Crea directory per i workspace
RUN mkdir -p /app/workspaces

# Imposta permessi
RUN chown -R node:node /app
USER node

# Esponi la porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http=require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "main.js"]
