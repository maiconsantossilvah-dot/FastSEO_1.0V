#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="fastseo-6a61b"
PROJECT_NUMBER="460968097608"
REGION="southamerica-east1"
SERVICE="fastseo-users-backend"
RUNTIME_ACCOUNT_NAME="fastseo-backend"
RUNTIME_ACCOUNT="${RUNTIME_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_ACCOUNT_NAME="fastseo-build"
BUILD_ACCOUNT="${BUILD_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
FRONTEND_ORIGIN="https://maiconsantossilvah-dot.github.io"

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com

if ! gcloud iam service-accounts describe "${RUNTIME_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_ACCOUNT_NAME}" \
    --display-name="FastSEO Cloud Run"
fi

if ! gcloud iam service-accounts describe "${BUILD_ACCOUNT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${BUILD_ACCOUNT_NAME}" \
    --display-name="FastSEO Cloud Build"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_ACCOUNT}" \
  --role="roles/run.builder" \
  --condition=None

gcloud run deploy "${SERVICE}" \
  --source=. \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --service-account="${RUNTIME_ACCOUNT}" \
  --build-service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_ACCOUNT}" \
  --allow-unauthenticated \
  --ingress=all \
  --set-env-vars="FIREBASE_PROJECT_ID=${PROJECT_ID},FRONTEND_ORIGINS=${FRONTEND_ORIGIN}" \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=40 \
  --timeout=30 \
  --min-instances=0 \
  --max-instances=3

SERVICE_URL="$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)')"

EXPECTED_URL="https://${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
printf '\nBackend publicado em: %s\n' "${SERVICE_URL}"
printf 'URL determinística configurada no frontend: %s/api\n' "${EXPECTED_URL}"
curl --fail --show-error --silent "${SERVICE_URL}/health"
printf '\n'
