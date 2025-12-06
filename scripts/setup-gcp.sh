#!/bin/bash
# Quick Setup Script for Google Cloud Deployment
# This script automates the initial setup for deploying Hail-Mary to Google Cloud
#
# Usage: ./setup-gcp.sh --project PROJECT_ID [OPTIONS]
#
# Options:
#   --project PROJECT_ID    GCP project ID (required)
#   --region REGION         Deployment region (default: us-central1)
#   --skip-apis             Skip enabling required APIs
#   --skip-secrets          Skip creating secrets (you'll need to create them manually)
#   --help                  Show this help message

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REGION="us-central1"
SKIP_APIS=false
SKIP_SECRETS=false
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
    --skip-apis)
      SKIP_APIS=true
      shift
      ;;
    --skip-secrets)
      SKIP_SECRETS=true
      shift
      ;;
    --help)
      grep '^#' "$0" | tail -n +2 | cut -c 3-
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}Error: --project is required${NC}"
  echo "Use --help for usage information"
  exit 1
fi

echo -e "${GREEN}🚀 Setting up Hail-Mary for Google Cloud${NC}"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo ""

# Set the active project
echo "📝 Setting active project..."
if ! gcloud config set project "$PROJECT_ID"; then
  echo -e "${RED}❌ Failed to set project. Please check if the project ID is correct.${NC}"
  exit 1
fi

# Enable required APIs
if [ "$SKIP_APIS" = false ]; then
  echo ""
  echo -e "${YELLOW}🔌 Enabling required Google Cloud APIs...${NC}"
  echo "   This may take a few minutes..."
  
  if ! gcloud services enable \
    cloudresourcemanager.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    sqladmin.googleapis.com; then
    echo -e "${RED}❌ Failed to enable APIs. Please check your permissions.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ APIs enabled${NC}"
else
  echo -e "${YELLOW}⏭️  Skipping API enablement${NC}"
fi

# Create Artifact Registry repository
echo ""
echo "📦 Creating Artifact Registry repository..."
if gcloud artifacts repositories describe hail-mary --location="$REGION" &>/dev/null; then
  echo -e "${YELLOW}   Repository 'hail-mary' already exists${NC}"
else
  gcloud artifacts repositories create hail-mary \
    --repository-format=docker \
    --location="$REGION" \
    --description="Hail-Mary container images"
  echo -e "${GREEN}✅ Repository created${NC}"
fi

# Configure Docker authentication
echo ""
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
echo -e "${GREEN}✅ Docker configured${NC}"

# Grant Secret Manager access
echo ""
echo "🔑 Setting up IAM permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
echo -e "${GREEN}✅ Permissions granted${NC}"

# Create secrets
if [ "$SKIP_SECRETS" = false ]; then
  echo ""
  echo -e "${YELLOW}🔒 Creating secrets in Secret Manager...${NC}"
  
  # Generate JWT secret
  if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
  elif command -v head &> /dev/null && [ -f /dev/urandom ]; then
    # Alternative method using /dev/urandom
    JWT_SECRET=$(head -c 32 /dev/urandom | xxd -p -c 64)
  else
    echo -e "${YELLOW}⚠️  Could not generate JWT secret automatically (openssl not found)${NC}"
    echo "Please generate a random 64-character hex string for JWT_SECRET"
    echo "You can use: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    read -p "JWT_SECRET: " JWT_SECRET
  fi
  
  # Create DATABASE_URL secret
  echo ""
  echo -e "${YELLOW}Please enter your PostgreSQL connection string:${NC}"
  echo "Format: postgresql://USER:PASSWORD@HOST:5432/hailmary"
  echo "Or for Cloud SQL: postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME"
  read -p "DATABASE_URL: " DATABASE_URL
  
  if [ -n "$DATABASE_URL" ]; then
    if gcloud secrets describe DATABASE_URL &>/dev/null; then
      echo -e "${YELLOW}   Secret 'DATABASE_URL' already exists, updating...${NC}"
      echo -n "$DATABASE_URL" | gcloud secrets versions add DATABASE_URL --data-file=-
    else
      echo -n "$DATABASE_URL" | gcloud secrets create DATABASE_URL --data-file=-
    fi
    echo -e "${GREEN}✅ DATABASE_URL created${NC}"
  fi
  
  # Create JWT_SECRET
  if gcloud secrets describe JWT_SECRET &>/dev/null; then
    echo -e "${YELLOW}   Secret 'JWT_SECRET' already exists, skipping...${NC}"
  else
    echo -n "$JWT_SECRET" | gcloud secrets create JWT_SECRET --data-file=-
    echo -e "${GREEN}✅ JWT_SECRET created (auto-generated)${NC}"
  fi
  
  # Ask about Gemini API key
  echo ""
  echo -e "${YELLOW}Do you want to configure the AI Assistant with a Gemini API key? (y/n)${NC}"
  read -p "Answer: " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Get your API key from: https://aistudio.google.com/app/apikey"
    read -p "GEMINI_API_KEY: " GEMINI_API_KEY
    
    if [ -n "$GEMINI_API_KEY" ]; then
      if gcloud secrets describe GEMINI_API_KEY &>/dev/null; then
        echo -e "${YELLOW}   Secret 'GEMINI_API_KEY' already exists, updating...${NC}"
        echo -n "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
      else
        echo -n "$GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY --data-file=-
      fi
      echo -e "${GREEN}✅ GEMINI_API_KEY created${NC}"
    fi
  fi
  
  # Ask about initial admin credentials
  echo ""
  echo -e "${YELLOW}Do you want to set custom initial admin credentials? (y/n)${NC}"
  echo "Default: admin@hailmary.local / HailMary2024!"
  read -p "Answer: " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Admin email: " ADMIN_EMAIL
    read -sp "Admin password: " ADMIN_PASSWORD
    echo
    
    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
      if gcloud secrets describe INITIAL_ADMIN_EMAIL &>/dev/null; then
        echo -n "$ADMIN_EMAIL" | gcloud secrets versions add INITIAL_ADMIN_EMAIL --data-file=-
      else
        echo -n "$ADMIN_EMAIL" | gcloud secrets create INITIAL_ADMIN_EMAIL --data-file=-
      fi
      
      if gcloud secrets describe INITIAL_ADMIN_PASSWORD &>/dev/null; then
        echo -n "$ADMIN_PASSWORD" | gcloud secrets versions add INITIAL_ADMIN_PASSWORD --data-file=-
      else
        echo -n "$ADMIN_PASSWORD" | gcloud secrets create INITIAL_ADMIN_PASSWORD --data-file=-
      fi
      echo -e "${GREEN}✅ Admin credentials created${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⏭️  Skipping secret creation${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Review the deployment guide: docs/DEPLOYMENT-GCP.md"
echo "   2. Deploy the API service:"
echo "      ./scripts/deploy-api-gcp.sh --project $PROJECT_ID --region $REGION --build"
echo "   3. Deploy the Assistant service (after API is deployed)"
echo "   4. Deploy the PWA service"
echo ""
echo "   Or deploy all services at once:"
echo "      gcloud builds submit --config cloudbuild.yaml"
echo ""
echo -e "${YELLOW}⚠️  Remember to set up your database and run migrations!${NC}"
