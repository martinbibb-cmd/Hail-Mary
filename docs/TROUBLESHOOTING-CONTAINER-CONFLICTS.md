# Troubleshooting Container Conflicts

This guide helps you resolve Docker container name conflicts when installing or updating Hail-Mary on unRAID.

## What Are Container Conflicts?

Container conflicts occur when Docker containers with the same names already exist on your system. This typically happens when:

1. **Previous Installation**: You previously installed Hail-Mary and the containers are still present
2. **Failed Installation**: A previous installation attempt failed partway through
3. **Manual Testing**: You manually created containers with conflicting names
4. **Network Conflicts**: The `hailmary-network` Docker network already exists

## How the Installation Script Handles Conflicts

The `install-unraid.sh` script automatically detects existing Hail-Mary containers and provides three options:

### Option 1: Remove Existing Containers (Recommended)

This option:
- Stops all running Hail-Mary containers
- Removes all Hail-Mary containers
- Cleans up the Docker network
- Allows fresh installation to proceed

**Data Impact**: Your database data in `/mnt/user/appdata/hailmary/postgres` is preserved. Only the containers themselves are removed.

### Option 2: Stop Existing Containers

This option:
- Stops running containers without removing them
- May still cause conflicts during installation
- Not recommended unless you have specific reasons to keep the containers

### Option 3: Cancel Installation

This option:
- Exits the installation script
- Allows you to manually investigate and resolve conflicts
- Useful if you need to backup data first

## Manual Conflict Resolution

If you prefer to resolve conflicts manually or if the automatic cleanup fails:

### 1. List Existing Hail-Mary Containers

```bash
docker ps -a | grep hailmary
```

You should see containers like:
- `hailmary-postgres`
- `hailmary-api`
- `hailmary-assistant`
- `hailmary-pwa`
- `hailmary-migrator`

### 2. Stop All Hail-Mary Containers

```bash
docker stop hailmary-postgres hailmary-api hailmary-assistant hailmary-pwa hailmary-migrator 2>/dev/null || true
```

### 3. Remove All Hail-Mary Containers

```bash
docker rm -f hailmary-postgres hailmary-api hailmary-assistant hailmary-pwa hailmary-migrator 2>/dev/null || true
```

### 4. Remove the Network (Optional)

```bash
docker network rm hailmary-network 2>/dev/null || true
```

### 5. Verify Cleanup

```bash
docker ps -a | grep hailmary
# Should return nothing
```

## Preserving Your Data

### Database Data

Your PostgreSQL database is stored in a Docker volume mapped to:
```
/mnt/user/appdata/hailmary/postgres
```

Removing containers does **NOT** delete this data. To completely start fresh with a clean database:

```bash
# Stop all containers first
docker stop hailmary-postgres hailmary-api hailmary-assistant hailmary-pwa hailmary-migrator 2>/dev/null || true

# Remove containers
docker rm -f hailmary-postgres hailmary-api hailmary-assistant hailmary-pwa hailmary-migrator 2>/dev/null || true

# Backup database (optional but recommended)
cp -r /mnt/user/appdata/hailmary/postgres /mnt/user/appdata/hailmary/postgres-backup-$(date +%Y%m%d-%H%M%S)

# Remove database data
rm -rf /mnt/user/appdata/hailmary/postgres
```

### Configuration Files

Your `.env` configuration file is preserved at:
```
/mnt/user/appdata/hailmary/.env
```

This file is never deleted during container cleanup.

## Common Error Messages

### "Conflict. The container name '/hailmary-postgres' is already in use"

**Cause**: A container with this name already exists.

**Solution**: Run the installation script again and choose Option 1 to remove existing containers.

**Manual Fix**:
```bash
docker rm -f hailmary-postgres
```

### "network hailmary-network already exists"

**Cause**: The Docker network from a previous installation still exists.

**Solution**: The script will reuse the existing network. If you want to remove it:

```bash
# Stop all containers first
docker stop $(docker ps -a | grep hailmary | awk '{print $1}') 2>/dev/null || true
docker rm $(docker ps -a | grep hailmary | awk '{print $1}') 2>/dev/null || true

# Remove the network
docker network rm hailmary-network
```

### "Error response from daemon: driver failed programming external connectivity on endpoint"

**Cause**: The port (default 8080) is already in use by another service.

**Solution**: Either stop the conflicting service or use a different port:

```bash
# Find what's using port 8080
netstat -tuln | grep 8080
# or
lsof -i :8080

# Install with a different port
./scripts/install-unraid.sh --port 9000
```

### "Cannot connect to the Docker daemon"

**Cause**: Docker service is not running or you don't have permissions.

**Solution**:
```bash
# Check Docker status
docker info

# If permission denied, add your user to the docker group (on unRAID this is usually automatic)
# Then log out and back in
```

## Best Practices

### Before Installing

1. **Check for existing installations**:
   ```bash
   docker ps -a | grep hailmary
   ```

2. **Backup important data** (if you have an existing installation):
   ```bash
   cp -r /mnt/user/appdata/hailmary/postgres /mnt/user/appdata/hailmary-backup
   cp /mnt/user/appdata/hailmary/.env /mnt/user/appdata/hailmary/.env.backup
   ```

### During Installation

1. **Read prompts carefully** - The script will explain what it's about to do
2. **Choose Option 1** (Remove containers) unless you have specific reasons not to
3. **Review error messages** - They often contain specific guidance

### After Installation

1. **Verify containers are running**:
   ```bash
   docker ps | grep hailmary
   ```

2. **Check logs if services aren't responding**:
   ```bash
   docker logs hailmary-api
   docker logs hailmary-postgres
   docker logs hailmary-pwa
   ```

## Debug Mode

For more detailed information during installation, enable debug mode:

```bash
DEBUG=true ./scripts/install-unraid.sh
```

This will show additional diagnostic information including:
- Container detection details
- Command execution details
- Full error outputs
- Docker command results

## Getting Help

If you continue to experience issues:

1. **Collect diagnostic information**:
   ```bash
   # List all containers
   docker ps -a > /tmp/docker-containers.txt
   
   # List all networks
   docker network ls > /tmp/docker-networks.txt
   
   # Check disk space
   df -h > /tmp/disk-space.txt
   
   # Show recent logs
   docker logs hailmary-postgres --tail 100 > /tmp/postgres-logs.txt 2>&1
   docker logs hailmary-api --tail 100 > /tmp/api-logs.txt 2>&1
   ```

2. **Create a GitHub issue** with:
   - Error messages you received
   - Output from diagnostic commands above
   - Your unRAID version
   - Steps you took before the error occurred

3. **Ask in the community**:
   - Include the same diagnostic information
   - Describe what you were trying to do
   - Mention any customizations you made

## Quick Reference Commands

```bash
# See all Hail-Mary containers
docker ps -a | grep hailmary

# Stop all Hail-Mary containers
docker stop $(docker ps -a | grep hailmary | awk '{print $1}') 2>/dev/null || true

# Remove all Hail-Mary containers
docker rm -f $(docker ps -a | grep hailmary | awk '{print $1}') 2>/dev/null || true

# Check container logs
docker logs <container-name>

# View real-time logs
docker logs -f <container-name>

# Check container status
docker ps | grep hailmary

# Restart a specific container
docker restart <container-name>

# Check disk usage
docker system df

# Clean up unused Docker resources
docker system prune -a
```

## Related Documentation

- [unRAID Deployment Guide](DEPLOYMENT-unRAID.md)
- [Installation Script Source](../scripts/install-unraid.sh)
- [Quick Start Guide](../QUICKSTART.md)
