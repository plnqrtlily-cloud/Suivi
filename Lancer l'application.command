#!/bin/bash
# Double-cliquez sur ce fichier dans le Finder pour lancer l'application.
# (La première fois, macOS peut demander une confirmation — voir le README
# pour la marche à suivre si "Impossible d'ouvrir" apparaît.)

cd "$(dirname "$0")"

echo "=========================================="
echo "  Suivi Coach <-> Athlete"
echo "=========================================="
echo ""

# Vérifie que Node.js est installé.
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé sur cet ordinateur."
  echo "Installez-le depuis https://nodejs.org (version 20 ou plus récente), puis relancez ce fichier."
  echo ""
  read -p "Appuyez sur Entrée pour fermer cette fenêtre..."
  exit 1
fi

# Installe les dépendances si ce n'est pas déjà fait (uniquement au premier lancement).
if [ ! -d "node_modules" ]; then
  echo "Premier lancement : installation des dépendances (peut prendre 1 à 2 minutes)..."
  npm install
  echo ""
fi

# Démarre le serveur Next.js en arrière-plan.
npm run dev -- -H 0.0.0.0 > /tmp/suivi-app-server.log 2>&1 &
SERVER_PID=$!

echo "Démarrage du serveur..."
for i in $(seq 1 30); do
  sleep 1
  if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
    break
  fi
done
open http://localhost:3000 2>/dev/null

# --- Lien public temporaire (cloudflared) ---
# Contourne entièrement les soucis de réseau local (Wi-Fi, pare-feu, proxy,
# isolation client) rencontrés en accès direct par adresse IP locale : le
# téléphone se connecte à une vraie adresse internet, plus au Mac directement.
# Fonctionne aussi en 4G/5G. Aucun compte, aucune inscription nécessaire
# (tunnel "rapide" gratuit de Cloudflare).
CLOUDFLARED_BIN=""
if command -v cloudflared >/dev/null 2>&1; then
  CLOUDFLARED_BIN="cloudflared"
elif [ -x "./bin/cloudflared" ]; then
  CLOUDFLARED_BIN="./bin/cloudflared"
else
  echo "Préparation du lien public (une seule fois, quelques secondes)..."
  mkdir -p ./bin
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
  else
    DL_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
  fi
  if curl -sL "$DL_URL" -o /tmp/cloudflared.tgz 2>/dev/null; then
    tar -xzf /tmp/cloudflared.tgz -C ./bin cloudflared 2>/dev/null
    chmod +x ./bin/cloudflared 2>/dev/null
    if [ -x "./bin/cloudflared" ]; then
      CLOUDFLARED_BIN="./bin/cloudflared"
    fi
  fi
fi

TUNNEL_PID=""
if [ -n "$CLOUDFLARED_BIN" ]; then
  "$CLOUDFLARED_BIN" tunnel --protocol http2 --url http://localhost:3000 > /tmp/suivi-app-tunnel.log 2>&1 &
  TUNNEL_PID=$!
  echo "Création du lien public (10-15 secondes)..."
  PUBLIC_URL=""
  for i in $(seq 1 25); do
    sleep 1
    PUBLIC_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/suivi-app-tunnel.log 2>/dev/null | head -1)
    if [ -n "$PUBLIC_URL" ]; then
      break
    fi
  done
  if [ -n "$PUBLIC_URL" ]; then
    echo "$PUBLIC_URL" | pbcopy 2>/dev/null
    echo "Vérification du lien..."
    LINK_OK="non"
    for i in $(seq 1 15); do
      sleep 1
      CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$PUBLIC_URL" 2>/dev/null)
      if [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
        LINK_OK="oui"
        break
      fi
    done
    echo ""
    echo "=========================================="
    if [ "$LINK_OK" = "oui" ]; then
      echo "  ✅ Lien vérifié et fonctionnel :"
    else
      echo "  ⚠️  Lien créé mais pas encore confirmé joignable"
      echo "  (patientez encore un peu avant de tester) :"
    fi
    echo "  $PUBLIC_URL"
    echo ""
    echo "  (déjà copié dans le presse-papier du Mac"
    echo "   -> envoyez-le-vous par Messages ou AirDrop)"
    echo "  Fonctionne partout : Wi-Fi, 4G/5G, ailleurs."
    echo "=========================================="
    echo ""
  else
    echo "!! Le lien public n'a pas pu être créé (pas de connexion internet ?)."
    echo "!! Voir le README, section réseau local, pour la solution de secours."
  fi
else
  echo "!! Impossible de préparer le lien public (pas de connexion internet ?)."
  echo "!! Voir le README, section réseau local, pour la solution de secours."
fi

echo "Laissez cette fenêtre ouverte tant que vous utilisez l'application."
echo "Pour tout arrêter : fermez cette fenêtre ou appuyez sur Ctrl+C."
echo ""

cleanup() {
  kill "$SERVER_PID" 2>/dev/null
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

wait "$SERVER_PID"
