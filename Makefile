.PHONY: help up down restart logs build clean update migrate seed

# Default target
help:
	@echo "🛠️  Hail-Mary Development Commands"
	@echo ""
	@echo "Stack Management:"
	@echo "  make up          - Start the stack"
	@echo "  make down        - Stop the stack"
	@echo "  make restart     - Restart the stack"
	@echo "  make build       - Build all containers"
	@echo "  make logs        - View all logs (follow mode)"
	@echo ""
	@echo "Updates:"
	@echo "  make update      - Pull latest code and restart stack"
	@echo "  make pull        - Pull latest code from git"
	@echo ""
	@echo "Database:"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed the database"
	@echo "  make db-shell    - Connect to PostgreSQL shell"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make reset       - Full reset (clean + rebuild)"
	@echo ""

# Start the stack
up:
	@echo "🚀 Starting Hail-Mary stack..."
	docker-compose up -d
	@echo "✅ Stack started!"
	@make status

# Stop the stack
down:
	@echo "🛑 Stopping Hail-Mary stack..."
	docker-compose down
	@echo "✅ Stack stopped!"

# Restart the stack
restart:
	@echo "🔄 Restarting Hail-Mary stack..."
	@make down
	@make up

# Build containers
build:
	@echo "🔨 Building containers..."
	docker-compose build --no-cache
	@echo "✅ Build complete!"

# View logs
logs:
	@echo "📋 Viewing logs (Ctrl+C to exit)..."
	docker-compose logs -f

# Pull latest code and restart
update:
	@echo "🔄 Pulling latest changes..."
	git pull
	@echo "📦 Installing dependencies..."
	npm install
	@echo "🔨 Rebuilding containers..."
	docker-compose build
	@echo "🔄 Restarting stack..."
	@make restart
	@echo "✅ Update complete!"

# Pull code only
pull:
	@echo "⬇️  Pulling latest code..."
	git pull
	@echo "✅ Pull complete!"

# Run migrations
migrate:
	@echo "🗄️  Running database migrations..."
	npm run db:migrate
	@echo "✅ Migrations complete!"

# Seed database
seed:
	@echo "🌱 Seeding database..."
	npm run db:seed
	@echo "✅ Seed complete!"

# PostgreSQL shell
db-shell:
	@echo "🐘 Connecting to PostgreSQL..."
	docker-compose exec hailmary-postgres psql -U hailmary -d hailmary

# Check status
status:
	@echo ""
	@echo "📊 Service Status:"
	@docker-compose ps

# Clean everything
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	docker-compose down -v
	@echo "✅ Cleanup complete!"

# Full reset
reset:
	@echo "⚠️  Full reset - this will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		make clean; \
		make build; \
		make up; \
		echo "✅ Reset complete!"; \
	else \
		echo "❌ Reset cancelled"; \
	fi
