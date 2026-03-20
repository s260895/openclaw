---
name: self-ops
description: Manage OpenClaw's own EC2 infrastructure. Use when checking server health, restarting gateway, viewing logs, deploying code updates, managing SSL certificates, updating config, or troubleshooting the production instance. Triggers on "server status", "restart gateway", "deploy changes", "check logs", "SSL renewal", "update config", "infrastructure", "EC2", "production server".
metadata: {"openclaw": {"emoji": "🔧", "requires": {"env": ["OPENCLAW_SSH_KEY_PATH"]}}}
---

# Self-Ops Skill

Manage OpenClaw's production EC2 infrastructure via SSH.

## Connection Details

| Component | Value |
|-----------|-------|
| EC2 IP | 16.58.140.99 |
| SSH User | ec2-user |
| Domain | openclaw.sumeetzankar.com |
| Gateway Port | 18789 (internal, proxied via nginx) |

## SSH Command Pattern

All SSH commands use the environment variable for the key path:

```bash
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "<command>"
```

## Quick Commands

### Check Server Health

```bash
# Gateway container status
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml ps"

# Gateway health endpoint
curl -s https://openclaw.sumeetzankar.com/healthz

# WhatsApp channel status
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && docker compose exec openclaw-gateway openclaw channels status"

# System resources (memory, swap, disk)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "free -h && df -h /"
```

### View Logs

```bash
# Recent gateway logs
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml logs --tail 100 openclaw-gateway"

# Follow logs in real-time
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml logs -f openclaw-gateway"

# nginx access/error logs
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "sudo tail -50 /var/log/nginx/access.log"
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "sudo tail -50 /var/log/nginx/error.log"
```

### Restart Gateway

```bash
# Restart container (preserves config)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml restart openclaw-gateway"
```

### Deploy Code Changes

```bash
# Pull latest code (no rebuild needed for most changes)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && git pull origin ec2-deploy"

# Full rebuild (only if Dockerfile changed)
ssh -i "$OPENCLAW_SSH_KEY_PATH" ec2-user@16.58.140.99 "cd ~/openclaw && docker compose down && docker build -t openclaw:local . && docker compose up -d"
```

## References

For detailed procedures, read these reference files:

- **Server setup**: `{baseDir}/references/ec2-server-setup.md` - How the EC2 instance was configured
- **Docker operations**: `{baseDir}/references/docker-operations.md` - Container management commands
- **nginx/SSL**: `{baseDir}/references/nginx-ssl.md` - Web server and certificate management
- **Config locations**: `{baseDir}/references/config-locations.md` - Where all config files live
- **Deployment workflow**: `{baseDir}/references/deployment-workflow.md` - Full deploy process

## Safety Guardrails

**Always confirm with owner before:**
- Rebuilding Docker image (takes 10+ minutes on t3.small)
- Modifying `~/.openclaw/openclaw.json`
- Changing nginx config
- Running commands that modify secrets/credentials

**Never:**
- Expose API keys, tokens, or credentials in output
- Stop the gateway without a plan to restart it
- Modify AWS Security Groups (owner controls firewall)
- Force-push to git (could lose changes)

**Owner controls:**
- EC2 Security Group (port 22 SSH access enable/disable)
- GitHub access token rotation
- Anthropic API key management
