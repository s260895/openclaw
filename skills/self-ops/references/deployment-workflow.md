# Deployment Workflow Reference

## Overview

The deployment workflow:
1. Make changes locally in the git repo
2. Commit and push to `ec2-deploy` branch
3. SSH to EC2 and pull changes
4. Restart gateway (rebuild only if Dockerfile changed)
5. Verify health

## Step-by-Step Deployment

### 1. Local: Make Changes

Edit files in the local git repo:
```
/Users/sumeetzankar/Documents/sumeet/personal/openclaw/
```

### 2. Local: Commit and Push

```bash
cd /Users/sumeetzankar/Documents/sumeet/personal/openclaw
git add <files>
git commit -m "description of changes"
git push origin ec2-deploy
```

### 3. EC2: Pull Changes

```bash
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && git pull origin ec2-deploy"
```

### 4. EC2: Apply Changes

**For most changes (skills, configs, extensions):**

```bash
# Just restart the gateway
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml restart openclaw-gateway"
```

**For Dockerfile changes:**

```bash
# Full rebuild (takes 10+ minutes)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && docker compose down && docker build -t openclaw:local . && docker compose up -d"
```

### 5. Verify Health

```bash
# Check container status
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml ps"

# Check health endpoint
curl -s https://openclaw.sumeetzankar.com/healthz

# Check WhatsApp
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && docker compose exec openclaw-gateway openclaw channels status"
```

## What Requires What

| Change Type | Action Required |
|-------------|-----------------|
| Skills (new/modified) | Restart gateway |
| Extensions code | Rebuild image |
| Dockerfile | Rebuild image |
| docker-compose.yml | Restart gateway |
| .env file | Restart gateway |
| openclaw.json | Restart gateway |
| nginx config | Reload nginx |

## Quick Deploy Commands

### Deploy skill changes (no rebuild)

```bash
# One-liner: push, pull, restart
git push origin ec2-deploy && \
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && git pull origin ec2-deploy && docker compose restart openclaw-gateway"
```

### Deploy with rebuild

```bash
# One-liner: push, pull, rebuild
git push origin ec2-deploy && \
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && git pull origin ec2-deploy && docker compose down && docker build -t openclaw:local . && docker compose up -d"
```

## Rollback

If a deployment breaks things:

```bash
# On EC2: revert to previous commit
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && git checkout HEAD~1 && docker compose restart openclaw-gateway"

# If rebuild needed
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && git checkout HEAD~1 && docker compose down && docker build -t openclaw:local . && docker compose up -d"
```

## Troubleshooting Deployments

### Git pull fails (merge conflict)

```bash
# Force reset to remote (LOSES LOCAL EC2 CHANGES)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && git fetch origin && git reset --hard origin/ec2-deploy"
```

### Gateway won't start after deploy

```bash
# Check logs for errors
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "docker compose -f ~/openclaw/docker-compose.yml logs --tail 50 openclaw-gateway"
```

### WhatsApp disconnected after deploy

Usually reconnects automatically. If not:

```bash
# Check WhatsApp status
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && docker compose exec openclaw-gateway openclaw channels status"

# May need to re-link (requires QR scan)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 \
  "cd ~/openclaw && docker compose run --rm openclaw-cli channels login"
```
