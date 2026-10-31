#!/usr/bin/env bash
# Cloud Scheduler jobs that call the API's /cron endpoints with an OIDC token (free: 3 jobs per billing account).
# Run after the API is deployed: bash deploy/04-scheduler.sh
set -euo pipefail
cd "$(dirname "$0")/.." && source deploy/config.sh

# Only the scheduler service account's tokens are accepted by the API (CRON_INVOKER_EMAIL).
gcloud run services add-iam-policy-binding "$API_SERVICE" --region="$REGION" \
  --member="serviceAccount:$SCHEDULER_SA" --role=roles/run.invoker >/dev/null

job() { # job <name> <path> <description>
  local args=(--location="$REGION" --schedule="0 9 * * *" --time-zone="Asia/Kolkata"
    --uri="$API_URL$2" --http-method=POST
    --oidc-service-account-email="$SCHEDULER_SA" --oidc-token-audience="$API_URL"
    --attempt-deadline=900s --max-retry-attempts=1 --min-backoff=300s --description="$3")
  if gcloud scheduler jobs describe "$1" --location="$REGION" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$1" "${args[@]}"
  else
    gcloud scheduler jobs create http "$1" "${args[@]}"
  fi
}

job sms-daily-maintenance /cron/daily-maintenance "Expire finished Premium plans; remind 3 days before expiry (09:00 IST)"
job sms-whatsapp-digests  /cron/whatsapp-digests  "WhatsApp match digests: Premium daily, Free weekly (09:00 IST)"
echo "Test now with: gcloud scheduler jobs run sms-daily-maintenance --location=$REGION"
