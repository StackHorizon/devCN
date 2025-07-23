#!/bin/bash

# Script di deployment per devCN
# Questo script prepara l'ambiente per la produzione

set -e

echo "🚀 Avvio deployment devCN..."

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funzione per logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Verifica prerequisiti
log "Verificando prerequisiti..."

if ! command -v docker &> /dev/null; then
    error "Docker non è installato!"
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose non è installato!"
fi

# Verifica che Docker sia in esecuzione
if ! docker info >/dev/null 2>&1; then
    error "Docker non è in esecuzione!"
fi

# Verifica file di configurazione
if [ ! -f "conf.json" ]; then
    warn "conf.json non trovato, creando template..."
    cat > conf.json << EOF
{
    "secretKey": "$(openssl rand -hex 32)",
    "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "user": "your-email@gmail.com",
        "pass": "your-app-password"
    },
    "database": {
        "redis_url": "redis://redis:6379"
    }
}
EOF
    warn "Aggiorna conf.json con le tue configurazioni!"
fi

if [ ! -f "admin.json" ]; then
    warn "admin.json non trovato, creando template..."
    cat > admin.json << EOF
{
    "username": "admin",
    "password": "$(openssl rand -base64 12)"
}
EOF
    warn "Aggiorna admin.json con le tue credenziali!"
fi

# Costruisci le immagini degli ambienti di sviluppo
log "Costruendo immagini Docker per ambienti di sviluppo..."
if [ -f "./build-images.sh" ]; then
    chmod +x ./build-images.sh
    ./build-images.sh
else
    warn "Script build-images.sh non trovato, continuando..."
fi

# Crea directory necessarie
log "Creando directory necessarie..."
mkdir -p workspaces
mkdir -p logs
mkdir -p ssl

# Imposta permessi
chmod 755 workspaces
chmod 755 logs

# Ferma eventuali container in esecuzione
log "Fermando container esistenti..."
docker-compose down 2>/dev/null || true

# Costruisci e avvia i servizi
log "Costruendo e avviando servizi..."
docker-compose build --no-cache
docker-compose up -d

# Attendi che i servizi siano pronti
log "Attendendo che i servizi siano pronti..."
for i in {1..30}; do
    if docker-compose exec -T app curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log "✅ Servizi pronti!"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Timeout: i servizi non sono diventati disponibili"
    fi
    sleep 2
done

# Mostra lo stato dei servizi
log "Stato dei servizi:"
docker-compose ps

# Mostra informazioni utili
log "🎉 Deployment completato!"
echo ""
echo "📋 Informazioni di accesso:"
echo "🌐 Applicazione: http://localhost:3000"
echo "📊 Health check: http://localhost:3000/health"
echo ""
echo "📁 Directory importanti:"
echo "  - workspaces/     -> Workspace degli studenti"
echo "  - logs/          -> Log dell'applicazione"
echo "  - conf.json      -> Configurazione"
echo "  - admin.json     -> Credenziali admin"
echo ""
echo "🔧 Comandi utili:"
echo "  - docker-compose logs -f        -> Visualizza log in tempo reale"
echo "  - docker-compose down           -> Ferma tutti i servizi"
echo "  - docker-compose up -d          -> Riavvia tutti i servizi"
echo "  - docker-compose restart app    -> Riavvia solo l'app"
echo ""

# Verifica configurazione
if grep -q "your-email@gmail.com" conf.json 2>/dev/null; then
    warn "⚠️  Ricordati di aggiornare conf.json con le tue configurazioni SMTP!"
fi

if grep -q '"password":' admin.json 2>/dev/null; then
    admin_pass=$(grep '"password":' admin.json | cut -d'"' -f4)
    log "🔑 Password admin generata: $admin_pass"
fi

log "Deployment completato con successo! 🚀"
