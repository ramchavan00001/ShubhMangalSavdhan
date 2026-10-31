#!/usr/bin/env bash
# One-time setup that costs nothing by itself: APIs, image repository, service accounts, permissions.
# Run once: bash deploy/01-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.." && source deploy/config.sh

echo "Enabling APIs…"
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com iam.googleapis.com \
  firebaseapphosting.googleapis.com developerconnect.googleapis.com

echo "Artifact Registry repository…"
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION" \
    --description="Shubh Mangal Savdhan images"
# Keep only the 5 newest images so storage stays inside the free 0.5 GB.
cat > /tmp/sms-ar-cleanup.json <<'JSON'
[{"name":"keep-recent","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":5}},
 {"name":"delete-old","action":{"type":"Delete"},"condition":{"tagState":"any","olderThan":"7d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies "$AR_REPO" --location="$REGION" --policy=/tmp/sms-ar-cleanup.json --no-dry-run

echo "Service accounts…"
for sa in sms-api:"Shubh Mangal Savdhan API (Cloud Run)" sms-scheduler:"Cloud Scheduler invoker"; do
  id=${sa%%:*}; name=${sa#*:}
  gcloud iam service-accounts describe "$id@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$id" --display-name="$name"
done

echo "API permissions: Cloud SQL client, read its secrets, logging…"
for role in roles/cloudsql.client roles/logging.logWriter roles/monitoring.metricWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$API_SA" --role="$role" --condition=None >/dev/null
done

echo "Cloud Build (default compute SA) may deploy Cloud Run and run jobs as the API service account…"
BUILD_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
for role in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter roles/secretmanager.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$BUILD_SA" --role="$role" --condition=None >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$API_SA" --member="serviceAccount:$BUILD_SA" --role=roles/iam.serviceAccountUser >/dev/null

echo "Photo bucket: only the API may read and write (the bucket must exist: Firebase console → Storage → Get started)…"
if gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$API_SA" --role=roles/storage.objectAdmin >/dev/null
  gcloud storage buckets update "gs://$BUCKET" --public-access-prevention --uniform-bucket-level-access
else
  echo "  !! gs://$BUCKET not found — create it in the Firebase console (location asia-south1), then re-run this script."
fi

echo "Done."
