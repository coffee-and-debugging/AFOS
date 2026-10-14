#!/bin/sh
# Apply migrations and seed (both idempotent), then hand off to the API.
# Retries cover the window where Postgres reports healthy but is still settling.
set -e

attempt=1
until node scripts/prisma.js migrate deploy; do
  if [ "$attempt" -ge 10 ]; then
    echo '{"level":"fatal","msg":"migrations failed after 10 attempts"}' >&2
    exit 1
  fi
  echo "{\"level\":\"warn\",\"msg\":\"migrate deploy failed, retrying\",\"attempt\":$attempt}"
  attempt=$((attempt + 1))
  sleep 3
done

node prisma/seed.js

exec node index.js
