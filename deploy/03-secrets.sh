#!/usr/bin/env bash
# Creates the API's secrets in Secret Manager (values are read from your shell, never echoed).
#   JWT_SECRET is generated. The others are read from environment variables of the same name;
#   any that are empty are skipped and can be added later by re-running this script.
# Run: MSG91_AUTH_KEY=… RAZORPAY_KEY_SECRET=… bash deploy/03-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.." && source deploy/config.sh

put() { # put <secret-name> <value>
  local name=$1 value=$2
  [ -z "$value" ] && { echo "  skip $name (no value)"; return; }
  gcloud secrets describe "$name" >/dev/null 2>&1 ||
    gcloud secrets create "$name" --replication-policy=user-managed --locations="$REGION" >/dev/null
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  gcloud secrets add-iam-policy-binding "$name" --member="serviceAccount:$API_SA" --role=roles/secretmanager.secretAccessor >/dev/null
  echo "  set $name"
}

gcloud secrets describe sms-jwt-secret >/dev/null 2>&1 || put sms-jwt-secret "$(openssl rand -hex 32)"
put sms-msg91-auth-key        "${MSG91_AUTH_KEY:-}"
put sms-razorpay-key-secret   "${RAZORPAY_KEY_SECRET:-}"
put sms-razorpay-webhook-secret "${RAZORPAY_WEBHOOK_SECRET:-}"
put sms-whatsapp-token        "${WHATSAPP_TOKEN:-}"
put sms-whatsapp-app-secret   "${WHATSAPP_APP_SECRET:-}"
put sms-whatsapp-verify-token "${WHATSAPP_VERIFY_TOKEN:-}"
put sms-smtp-pass             "${SMTP_PASS:-}"
put sms-anthropic-api-key     "${ANTHROPIC_API_KEY:-}"
