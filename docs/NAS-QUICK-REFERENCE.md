# Hail-Mary NAS Quick Reference 📋

## Common Commands

### View Application
```bash
# Open in browser
http://your-nas-ip:3000
```

### Update Now
```bash
cd /opt/hail-mary  # or /mnt/user/appdata/hailmary on unRAID
./scripts/nas-deploy.sh
```

### View Logs
```bash
# Update logs
tail -f /var/log/hail-mary-updates.log

# Application logs
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f hailmary-api
docker-compose -f docker-compose.prod.yml logs -f hailmary-pwa
```

### Container Management
```bash
# View status
docker-compose -f docker-compose.prod.yml ps

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart hailmary-api

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

### Database Operations
```bash
# Database migrations
docker exec -it hailmary-api npm run db:push

# Create admin user
docker exec -it hailmary-api npm run admin:create -- email@example.com password123 "Name"

# Reset password
docker exec -it hailmary-api npm run admin:reset-password -- email@example.com newpassword

# List users
docker exec -it hailmary-api npm run admin:list-users
```

### Auto-Update Configuration
```bash
# Enable auto-updates (checks every 5 min)
./scripts/enable-autoupdate.sh

# View cron jobs
crontab -l

# Disable auto-updates
crontab -l | grep -v 'check-updates.sh' | crontab -

# Force immediate check
/opt/hail-mary/scripts/check-updates.sh
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs for errors
docker-compose -f docker-compose.prod.yml logs

# Verify environment variables
cat .env

# Restart from scratch
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Can't Login
```bash
# Reset admin password (default admin@hailmary.local)
docker exec -it hailmary-api npm run admin:reset-password -- admin@hailmary.local NewPassword123
```

### Updates Not Working
```bash
# Test GHCR access
docker pull ghcr.io/martinbibb-cmd/hail-mary-api:latest

# If authentication needed
echo $GITHUB_TOKEN | docker login ghcr.io -u martinbibb-cmd --password-stdin

# Force pull and recreate
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

### Database Issues
```bash
# Check database is running
docker exec hailmary-postgres pg_isready -U postgres -d hailmary

# View database logs
docker logs hailmary-postgres

# Backup database
docker exec hailmary-postgres pg_dump -U postgres hailmary > backup.sql

# Restore database
cat backup.sql | docker exec -i hailmary-postgres psql -U postgres -d hailmary
```

## Default Credentials

- **Email:** admin@hailmary.local
- **Password:** HailMary2024!

⚠️ Change these immediately in production!

## Important Files

- **Configuration:** `/opt/hail-mary/.env`
- **Update logs:** `/var/log/hail-mary-updates.log`
- **Database data:** `/var/lib/docker/volumes/hailmary-postgres-data/`
- **Docker Compose:** `/opt/hail-mary/docker-compose.prod.yml`

## URLs

- **Application:** http://your-nas-ip:3000
- **GitHub Repo:** https://github.com/martinbibb-cmd/Hail-Mary
- **GitHub Actions:** https://github.com/martinbibb-cmd/Hail-Mary/actions
- **Container Registry:** https://github.com/martinbibb-cmd?tab=packages

## Support

📚 Full documentation: https://github.com/martinbibb-cmd/Hail-Mary/tree/main/docs

- [Enable Auto-Updates Guide](./ENABLE-AUTO-UPDATES.md)
- [NAS Deployment Guide](./NAS_DEPLOYMENT.md)
- [Complete Deployment Guide](./DEPLOYMENT.md)
