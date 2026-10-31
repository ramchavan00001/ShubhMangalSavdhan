#!/usr/bin/env bash
# Creates the PAID Cloud SQL for PostgreSQL instance (≈ US$10–13 a month for db-f1-micro in Mumbai)
# and stores the API's DATABASE_URL in Secret Manager. Run once: bash deploy/02-cloudsql.sh
set -euo pipefail
cd "$(dirname "$0")/.." && source deploy/config.sh

if ! gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  echo "Creating Cloud SQL instance $SQL_INSTANCE ($SQL_TIER, $REGION) — takes ~10 minutes…"
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=ENTERPRISE --tier="$SQL_TIER" --region="$REGION" \
    --storage-type=SSD --storage-size=10 --storage-auto-increase \
    --backup-start-time=21:00 --retained-backups-count=7 --enable-point-in-time-recovery \
    --maintenance-window-day=SUN --maintenance-window-hour=22 \
    --deletion-protection
  # 21:00 / 22:00 UTC = 02:30 / 03:30 IST
fi

gcloud sql databases describe "$SQL_DB" --instance="$SQL_INSTANCE" >/dev/null 2>&1 ||
  gcloud sql databases create "$SQL_DB" --instance="$SQL_INSTANCE"

if ! gcloud secrets describe sms-database-url >/dev/null 2>&1; then
  PASS=$(openssl rand -hex 24)
  gcloud sql users create "$SQL_USER" --instance="$SQL_INSTANCE" --password="$PASS"
  # Cloud Run reaches the instance through the built-in Cloud SQL connector socket. 5 connections per API instance.
  printf 'postgresql://%s:%s@localhost/%s?host=/cloudsql/%s&connection_limit=5' "$SQL_USER" "$PASS" "$SQL_DB" "$SQL_CONNECTION" |
    gcloud secrets create sms-database-url --replication-policy=user-managed --locations="$REGION" --data-file=-
  gcloud secrets add-iam-policy-binding sms-database-url --member="serviceAccount:$API_SA" --role=roles/secretmanager.secretAccessor >/dev/null
  unset PASS
fi
echo "Cloud SQL ready: $SQL_CONNECTION"
