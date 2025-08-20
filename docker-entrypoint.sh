#!/bin/sh
set -e

echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"
echo "[entrypoint] Running Prisma migrations..."
prisma migrate deploy

echo "[entrypoint] Starting app..."
exec node server.js


