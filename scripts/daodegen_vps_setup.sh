#!/usr/bin/env bash
# daodegen VPS setup script for Dr. Claw
# GH#216 — Docker Compose prod deploy on 100.70.68.20
# Run as: bash daodegen_vps_setup.sh
set -euo pipefail

echo "=== daodegen VPS Setup ==="
echo "This script sets up the daodegen stack on the prod VPS."
echo ""

REPO_DIR="$HOME/daodegen"
ENV_FILE="$REPO_DIR/.env.prod"

# 1. Clone or pull repo
if [ -d "$REPO_DIR/.git" ]; then
  echo "[1/6] Pulling latest daodegen..."
  git -C "$REPO_DIR" pull
else
  echo "[1/6] Cloning daodegen..."
  git clone https://github.com/0xPotatoofdoom/daodegen "$REPO_DIR"
fi

# 2. Check for env file
echo "[2/6] Checking prod env..."
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "Leo needs to push the secrets file. Run:"
  echo "  scp /Users/matt/.openclaw/workspace/daodegen.env.prod matt@100.70.68.20:$ENV_FILE"
  echo "Then re-run this script."
  exit 1
fi
echo "Prod env found ✓"

# 3. Check docker compose
echo "[3/6] Checking Docker..."
docker compose version || { echo "Docker Compose not found. Install: sudo apt install docker-compose-plugin"; exit 1; }

# 4. Check port availability
echo "[4/6] Checking ports..."
for port in 3001 4402 42069; do
  if ss -tlnp | grep -q ":$port "; then
    echo "WARNING: port $port is in use"
    ss -tlnp | grep ":$port "
  else
    echo "  port $port free ✓"
  fi
done

# 5. Build and start
echo "[5/6] Starting Docker Compose stack..."
cd "$REPO_DIR"

# Override frontend port to 3001 (avoid Mission Control on :3000)
export FRONTEND_PORT=3001

docker compose --env-file "$ENV_FILE" up -d --build 2>&1

echo ""
echo "[6/6] Service status:"
docker compose ps

echo ""
echo "=== Health checks ==="
sleep 5
curl -sf http://localhost:3001 > /dev/null && echo "Frontend :3001 ✓" || echo "Frontend :3001 ✗ — check: docker compose logs frontend"
curl -sf http://localhost:4402/health > /dev/null && echo "Facilitator :4402 ✓" || echo "Facilitator :4402 — may not have /health endpoint, check logs"

echo ""
echo "=== Next: nginx config ==="
echo "Add this to /etc/nginx/sites-available/daodegen:"
cat << 'NGINX'
server {
    listen 80;
    server_name 0xdead.church www.0xdead.church;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /v1/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX

echo ""
echo "Then: sudo ln -s /etc/nginx/sites-available/daodegen /etc/nginx/sites-enabled/"
echo "      sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "=== GH#216 complete — proceed to GH#217 (DNS + SSL) ==="
