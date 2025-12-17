# Getting Started: NAS Auto-Updates 🚀

## Quick Answer

**Q: "This is installed on my NAS can we push updates?"**

**A: YES! ✅** You have two options:

### Option 1: Automatic Updates (Recommended)
Run this one command on your NAS:

```bash
curl -fsSL https://raw.githubusercontent.com/martinbibb-cmd/Hail-Mary/main/scripts/enable-autoupdate.sh | bash
```

That's it! Your NAS will now automatically receive updates when you push code to GitHub.

### Option 2: Safe Update Script (Recommended for Unraid) ⭐
A single script that handles everything: pull, migrate, restart, and health checks.

**Installation (Unraid User Script):**
1. Go to **Settings → User Scripts** in Unraid
2. Click **Add New Script** → Name it: `Update PHM (safe + migrate)`
3. Copy contents of `scripts/unraid-safe-update.sh` into the script
4. Click **Run Script** to update

**What it does:**
- ✅ Pulls latest Docker images
- ✅ Runs database migrations automatically
- ✅ Restarts services
- ✅ Performs health checks

See [Unraid Safe Update Guide](./docs/UNRAID-SAFE-UPDATE.md) for detailed instructions.

### Option 3: Manual Web Interface
For admin users, you can now manage updates directly from the web interface:

1. Login at `http://nas.cloudbibb.uk/login`
2. Open your profile and click "🖥️ NAS Management"
3. Use the buttons to:
   - Check for updates
   - Deploy updates
   - Run database migrations

See [NAS Admin Management Guide](./docs/NAS-ADMIN-MANAGEMENT.md) for detailed instructions.

---

## What This Does

After running the setup command:

1. ✅ **Automatic checks** every 5 minutes for new Docker images
2. ✅ **Automatic downloads** when new versions are available
3. ✅ **Automatic restarts** with zero-downtime deployment
4. ✅ **Complete logging** of all updates

## Your New Workflow

### Before (Manual)
```
1. Make code changes
2. Build Docker images locally
3. SSH to NAS
4. Pull images manually
5. Restart containers manually
```

### After (Automatic)
```
1. Make code changes
2. Push to GitHub: git push origin main
3. ☕ Wait ~15 minutes
4. Done! Your NAS has the update
```

## How Long Does It Take?

- **GitHub Actions build**: 5-10 minutes
- **NAS auto-update**: Within 5 minutes
- **Total**: ~15 minutes from `git push` to deployed on NAS

## Where Are Updates Logged?

```bash
# View real-time updates
tail -f /var/log/hail-mary-updates.log
```

Example log output:
```
2024-12-13 20:15:00 No updates available
2024-12-13 20:20:00 Updates detected, checking what changed...
2024-12-13 20:20:05   → API service updated
2024-12-13 20:20:05   → PWA service updated
2024-12-13 20:20:10 Restarting containers with new images...
2024-12-13 20:20:15 ✓ Update completed successfully
```

## Manual Update (If You Can't Wait)

Force an immediate update without waiting for the next cron cycle:

```bash
# SSH to your NAS
ssh admin@your-nas

# Run the update script manually
/opt/hail-mary/scripts/nas-deploy.sh
```

Or trigger a GitHub Actions build manually:
1. Go to: https://github.com/martinbibb-cmd/Hail-Mary/actions
2. Click "Build and Push Docker Images"
3. Click "Run workflow" → "Run workflow"

## Verify It's Working

### 1. Check Auto-Update Is Configured

```bash
# View cron jobs
crontab -l

# You should see something like:
# */5 * * * * /opt/hail-mary/scripts/check-updates.sh
```

### 2. Test With a Code Change

```bash
# Make a trivial change
echo "# Test" >> README.md

# Push to GitHub
git add README.md
git commit -m "Test auto-update"
git push origin main

# Watch the update happen
ssh admin@your-nas
tail -f /var/log/hail-mary-updates.log
```

## Common Commands

```bash
# View update logs
tail -f /var/log/hail-mary-updates.log

# View application logs
docker-compose -f docker-compose.prod.yml logs -f

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Force immediate update
/opt/hail-mary/scripts/nas-deploy.sh

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

## Troubleshooting

### "manifest not found" error

**Problem:** Can't pull images from GHCR

**Solution:** Make sure images are public or authenticate:

```bash
# For private images, create a GitHub Personal Access Token
# then login:
echo $TOKEN | docker login ghcr.io -u martinbibb-cmd --password-stdin
```

### Updates not happening

**Check 1:** Is cron job installed?
```bash
crontab -l | grep check-updates
```

**Check 2:** Are images being built?
```bash
# Visit GitHub Actions
https://github.com/martinbibb-cmd/Hail-Mary/actions
```

**Check 3:** Force a manual update
```bash
/opt/hail-mary/scripts/check-updates.sh
```

## Disable Auto-Updates

If you want to go back to manual updates:

```bash
# Remove the cron job
crontab -l | grep -v 'check-updates.sh' | crontab -
```

## More Information

- 📚 **Complete Guide**: [docs/ENABLE-AUTO-UPDATES.md](./docs/ENABLE-AUTO-UPDATES.md)
- 📋 **Quick Reference**: [docs/NAS-QUICK-REFERENCE.md](./docs/NAS-QUICK-REFERENCE.md)
- 📖 **Summary**: [docs/PUSH-UPDATES-SUMMARY.md](./docs/PUSH-UPDATES-SUMMARY.md)
- 🏠 **NAS Deployment**: [docs/NAS_DEPLOYMENT.md](./docs/NAS_DEPLOYMENT.md)

## Summary

✅ **One command** to set up auto-updates  
✅ **Zero manual intervention** needed after setup  
✅ **15 minutes** from code push to NAS deployment  
✅ **Complete logging** of all updates  
✅ **Safe and reliable** with automatic rollback on failures  

**You can now focus on development - your NAS handles the rest!** 🎉
