#!/bin/bash
# Deploy Hail-Mary API to Google Cloud Run
# Usage: ./deploy-api.sh [OPTIONS]
#
# Options:
#   --project PROJECT_ID    GCP project ID (required)
#   --region REGION         Deployment region (default: us-central1)
#   --service-name NAME     Cloud Run service name (default: hail-mary-api)
#   --build                 Build and push image before deploying
#   --help                  Show this help message

set -e

# Default values
REGION="us-central1"
SERVICE_NAME="hail-mary-api"
BUILD_IMAGE=false
PROJECT_ID=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --build)
      BUILD_IMAGE=true
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +2 | cut -c 3-
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$PROJECT_ID" ]; then
  echo "Error: --project is required"
  echo "Use --help for usage information"
  exit 1
fi

echo "🚀 Deploying Hail-Mary API to Google Cloud Run"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo ""

# Set the active project
gcloud config set project "$PROJECT_ID"

# Build and push image if requested
if [ "$BUILD_IMAGE" = true ]; then
  echo "📦 Building Docker image..."
  IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/hail-mary/api:latest"
  
  docker build -f packages/api/Dockerfile -t "$IMAGE_URL" .
  
  echo "⬆️  Pushing image to Artifact Registry..."
  docker push "$IMAGE_URL"
  
  IMAGE_ARG="--image=$IMAGE_URL"
else
  echo "ℹ️  Skipping build (use --build to build and push image)"
  IMAGE_ARG="--source=."
fi

echo "🌐 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  $IMAGE_ARG \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars=NODE_ENV=production,PORT=3001 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest \
  --timeout=300s

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "   Service URL: $SERVICE_URL"
echo ""
echo "📝 Next steps:"
echo "   1. Test the API: curl $SERVICE_URL/health"
echo "   2. Run database migrations if needed"
echo "   3. Deploy the Assistant service with API_BASE_URL=$SERVICE_URL"
