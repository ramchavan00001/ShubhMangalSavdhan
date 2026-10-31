# Shared settings for the deploy scripts. Source it: `source deploy/config.sh`
export PROJECT_ID=shubh-mangal-savdhan
export PROJECT_NUMBER=268568048663
export REGION=asia-south1                 # Mumbai: API, database, storage, scheduler

export AR_REPO=sms                        # Artifact Registry Docker repository
export API_SERVICE=sms-api                # Cloud Run service
export MIGRATE_JOB=sms-api-migrate        # Cloud Run job: prisma migrate deploy
export SEED_JOB=sms-api-seed              # Cloud Run job: dropdown lists + admin accounts
export API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/api"
# Deterministic Cloud Run URL (also the audience of Cloud Scheduler's OIDC tokens).
export API_URL="https://$API_SERVICE-$PROJECT_NUMBER.$REGION.run.app"

export API_SA="sms-api@$PROJECT_ID.iam.gserviceaccount.com"            # runtime identity of the API
export SCHEDULER_SA="sms-scheduler@$PROJECT_ID.iam.gserviceaccount.com" # Cloud Scheduler signs tokens as this

export SQL_INSTANCE=sms-db
export SQL_TIER=db-f1-micro               # shared core, 0.6 GB RAM; move to db-g1-small / db-custom-1-3840 as traffic grows
export SQL_DB=sms
export SQL_USER=sms
export SQL_CONNECTION="$PROJECT_ID:$REGION:$SQL_INSTANCE"

export BUCKET="$PROJECT_ID.firebasestorage.app"   # default Firebase Storage bucket

# Public website URL. App Hosting is not offered in asia-south1; its closest region is asia-southeast1.
export WEB_URL="${WEB_URL:-https://sms-web--$PROJECT_ID.asia-southeast1.hosted.app}"

gcloud config set project "$PROJECT_ID" >/dev/null
