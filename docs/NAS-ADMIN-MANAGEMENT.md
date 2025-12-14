# NAS Admin Management

## Overview

The NAS Admin Management feature allows administrators to manage NAS deployments directly from the web interface. This includes checking for updates, deploying new versions, and running database migrations.

## Accessing NAS Management

1. **Login as Admin**: Access the application at `http://nas.cloudbibb.uk/login`
2. **Open Profile**: Click on your profile icon in the application
3. **Navigate to NAS Management**: Click the "🖥️ NAS Management" button (admin users only)

## Features

### 1. Check for Updates

**Purpose**: Check if newer Docker images are available without applying them.

**How to use**:
- Click the "🔍 Check for Updates" button
- The system will pull the latest images and report if any updates are available
- No services are restarted during this check

**When to use**: 
- Before planning a deployment to see if updates are available
- Regular monitoring to stay informed about new versions

### 2. Pull & Deploy Updates

**Purpose**: Pull the latest Docker images and restart all containers with the new versions.

**How to use**:
- Click the "⬇️ Pull & Deploy Updates" button
- Confirm the action when prompted
- The system will:
  - Pull the latest Docker images from GitHub Container Registry
  - Restart containers with zero-downtime deployment
  - Clean up old images
  - Perform health checks

**When to use**:
- After checking for updates and confirming you want to deploy
- When you know a new version has been released
- As part of routine maintenance

**Important**: This will cause a brief service interruption (usually < 30 seconds)

### 3. Run Database Migrations

**Purpose**: Apply any pending database schema changes.

**How to use**:
- Click the "🗄️ Run Database Migrations" button
- Confirm the action when prompted
- The system will run the migration script and display the results

**When to use**:
- After deploying updates that include database schema changes
- When the database appears to not be updating correctly
- After restoring from a backup

**Important**: Always ensure you have a recent database backup before running migrations

## Troubleshooting

### Issue: "Database doesn't appear to be updating"

**Solution**: This is the primary issue this feature addresses. Follow these steps:

1. **Check for Updates**: Use the "Check for Updates" button to see if there are newer versions available
2. **Deploy Updates**: If updates are available, use "Pull & Deploy Updates" to get the latest version
3. **Run Migrations**: After deploying, use "Run Database Migrations" to apply any pending schema changes

### Issue: "NAS deployment scripts not found"

**Cause**: The application is not running in a NAS deployment environment or the deployment directory is misconfigured.

**Solution**: 
- Verify the application is running on the NAS at `/opt/hail-mary`
- Check that the `DEPLOY_DIR` environment variable is correctly set
- Ensure the `nas-deploy.sh` script exists in the `scripts` directory

### Issue: "Access denied. Admin privileges required"

**Cause**: Your user account does not have admin role.

**Solution**: Contact your system administrator to grant admin privileges to your account.

### Issue: Operation times out

**Cause**: Network issues or slow Docker operations.

**Solution**:
- Wait for the operation to complete (timeouts are set to 2-5 minutes)
- Check your internet connection
- Try the operation again

## Output Logs

After each operation, detailed output logs are displayed in the interface. These logs include:
- Command output from Docker and migration scripts
- Success or error messages
- Timestamps and status information

**Tip**: Copy and save these logs if you need to troubleshoot issues or report problems.

## Security

All NAS Management operations:
- ✅ Require admin authentication
- ✅ Are logged for audit purposes
- ✅ Use validated and sanitized paths
- ✅ Have reasonable timeout limits
- ✅ Require user confirmation for destructive operations

## API Endpoints

For automation or programmatic access, the following endpoints are available:

- `GET /api/admin/nas/status` - Get current deployment status
- `POST /api/admin/nas/check-updates` - Check for available updates
- `POST /api/admin/nas/pull-updates` - Pull and deploy updates
- `POST /api/admin/nas/migrate` - Run database migrations

All endpoints require admin authentication (include credentials in request).

## Best Practices

1. **Regular Updates**: Check for updates weekly and apply them during low-usage periods
2. **Backup First**: Always ensure you have a recent backup before running migrations
3. **Monitor Logs**: Review the output logs to ensure operations completed successfully
4. **Test Migrations**: If possible, test migrations on a staging environment first
5. **Schedule Maintenance**: Inform users before deploying updates during business hours

## Related Documentation

- [NAS Deployment Guide](./NAS_DEPLOYMENT.md)
- [Enable Auto-Updates](./ENABLE-AUTO-UPDATES.md)
- [NAS Quick Reference](./NAS-QUICK-REFERENCE.md)
- [Getting Started: NAS Updates](../GETTING-STARTED-NAS-UPDATES.md)
