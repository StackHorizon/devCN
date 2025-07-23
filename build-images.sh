#!/bin/bash

# Script per costruire tutte le immagini Docker per gli ambienti di sviluppo
# Questo script deve essere eseguito per preparare le immagini prima di avviare il server

echo "🐳 Costruendo immagini Docker per ambienti di sviluppo..."

# Array dei tipi di ambiente
ENVIRONMENTS=("nodejs" "python" "cpp" "java" "vuoto")

# Directory base
BASE_DIR=$(dirname "$0")
DOCKERFILE_DIR="$BASE_DIR/dockerfiles"

# Verifica che la directory dockerfiles esista
if [ ! -d "$DOCKERFILE_DIR" ]; then
    echo "❌ Errore: Directory dockerfiles non trovata!"
    exit 1
fi

# Funzione per costruire un'immagine
build_image() {
    local env_type=$1
    local dockerfile="$DOCKERFILE_DIR/Dockerfile.$env_type"
    local image_name="devenv-$env_type:latest"
    
    echo "📦 Costruendo immagine per $env_type..."
    
    if [ ! -f "$dockerfile" ]; then
        echo "⚠️  Dockerfile non trovato: $dockerfile"
        return 1
    fi
    
    # Costruisci l'immagine
    if docker build -f "$dockerfile" -t "$image_name" "$BASE_DIR"; then
        echo "✅ Immagine $image_name costruita con successo!"
        return 0
    else
        echo "❌ Errore nella costruzione di $image_name"
        return 1
    fi
}

# Conta successi e fallimenti
successful=0
failed=0

# Costruisci tutte le immagini
for env in "${ENVIRONMENTS[@]}"; do
    if build_image "$env"; then
        ((successful++))
    else
        ((failed++))
    fi
    echo ""
done

# Report finale
echo "📊 Report costruzione immagini:"
echo "✅ Successi: $successful"
echo "❌ Fallimenti: $failed"

if [ $failed -eq 0 ]; then
    echo "🎉 Tutte le immagini sono state costruite con successo!"
    echo ""
    echo "📋 Immagini disponibili:"
    for env in "${ENVIRONMENTS[@]}"; do
        echo "  - devenv-$env:latest"
    done
    echo ""
    echo "🚀 Il server è ora pronto per creare ambienti di sviluppo!"
else
    echo "⚠️  Alcune immagini non sono state costruite correttamente."
    echo "Controlla i log sopra per i dettagli degli errori."
    exit 1
fi
