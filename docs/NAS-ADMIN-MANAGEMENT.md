# NAS Admin Management

## Overview

The NAS Admin page is now a **status and playbook hub**. It surfaces live health data from the NAS containers and gives you the exact host-side commands that align with the deployment roadmap (safe update script + scheduled auto-updates). Docker operations now happen directly on the NAS to avoid docker-in-docker failures.

## Accessing NAS Management

1. **Login as Admin**: Access the application at `http://nas.cloudbibb.uk/login`
2. **Open Profile**: Click on your profile icon in the application
3. **Navigate to NAS Management**: Click the "🖥️ NAS Management" button (admin users only)

## What You Can Do

### 1) Review system health
- Database connectivity and latency
- API version, uptime, and Docker/native runtime flag
- Migration status and degraded subsystem notes
- NAS auth mode status (for trusted LAN quick-login setups)

### 2) Follow the deployment playbooks (host-side)
Run these from the NAS (Unraid terminal/SSH). They match the roadmap and replace the old in-app Docker actions.

**Safe update (manual run)**
```bash
cd /mnt/user/appdata/hailmary
bash ./scripts/unraid-safe-update.sh
```
- Pulls the latest images
- Runs database migrations
- Restarts services and performs health checks

**Enable scheduled auto-updates**
```bash
cd /mnt/user/appdata/hailmary
bash ./scripts/setup-unraid-autoupdate.sh --interval "0 * * * *"
```
- Installs the cron-backed updater
- Checks GHCR for new images and applies them with migrations
- Keeps the NAS on-track with the roadmap without manual clicks

### 3) Re-run migrations (fallback)
The UI still exposes a migration button for recovery. Safe update already runs migrations; trigger this only if you need to reapply the latest schema.

## Troubleshooting

- **Database looks stale**: Run the safe update script, then (if needed) re-run migrations from the UI.
- **Status shows degraded subsystems**: Inspect the notes shown in the UI; fix config/data issues and refresh.
- **Auto-updates not running**: Re-run `setup-unraid-autoupdate.sh` to reinstall the cron job; verify with `crontab -l` and `/var/log/user.scripts` in Unraid.
- **Access denied**: Ensure your account has the admin role.

## API Endpoints

- `GET /api/admin/system/status` — Admin health view used by the UI
- `POST /api/admin/system/migrate` — Admin-triggered migration (UI fallback)
- `GET /api/nas/status` — Public NAS health check for monitors

The previous `/api/admin/nas/*` Docker-control endpoints were removed to keep deployment on the host.

## Best Practices

1. Use **safe update** after pushing changes or before maintenance windows.
2. Enable **scheduled auto-updates** so the NAS tracks new images automatically.
3. Keep backups current before running manual migrations.
4. Treat the UI migration button as a recovery tool, not the primary update path.

## Related Documentation

- [NAS Deployment Guide](./NAS_DEPLOYMENT.md)
- [Enable Auto-Updates](./ENABLE-AUTO-UPDATES.md)
- [NAS Quick Reference](./NAS-QUICK-REFERENCE.md)
- [Getting Started: NAS Updates](../GETTING-STARTED-NAS-UPDATES.md)
