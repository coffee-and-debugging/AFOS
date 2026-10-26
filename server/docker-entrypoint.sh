#!/bin/sh
# Apply migrations (idempotent), then hand off to the API.
# Seeding is NOT run on start, so the database is left exactly as it is. To create the
# starter accounts/demo data on a fresh database, run it by hand: npm run db:seed
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

exec node index.js
