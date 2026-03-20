---
name: self-ops
description: Manage OpenClaw's own EC2 infrastructure. Use when checking server health, restarting gateway, viewing logs, deploying code updates, managing SSL certificates, updating config, or troubleshooting the production instance. Triggers on "server status", "restart gateway", "deploy changes", "check logs", "SSL renewal", "update config", "infrastructure", "EC2", "production server".
metadata: {"openclaw": {"emoji": "🔧"}}
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

All SSH commands use the environment variable for the key path, with host key checking disabled (safe since we're connecting to ourselves):

```bash
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ec2-user@16.58.140.99 "<command>"
```

**Important:** Always include `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null` in SSH commands.

**Also add a timeout:** Use `-o ConnectTimeout=10` to avoid hanging on network issues.

## SSH Troubleshooting

If SSH commands fail with "Connection timed out" or "Connection refused":

1. **Check firewall:** The AWS Security Group must allow SSH (port 22) from the EC2's own Elastic IP (16.58.140.99)
2. **Ask the owner:** "SSH is timing out. Please check if the AWS Security Group allows SSH access from 16.58.140.99 (the EC2 instance's own IP). The instance needs to SSH to itself for self-management."
3. **Fallback:** Use `curl https://openclaw.sumeetzankar.com/healthz` to verify the gateway is at least responding on HTTPS

## Git Troubleshooting

If `git pull` fails with authentication errors like:
- "Authentication failed"
- "could not read Username"
- "remote: Invalid username or password"
- "fatal: Authentication failed for 'https://github.com/...'"

**This means the GitHub token has expired.**

**Ask the owner:** "Git authentication failed - the GitHub access token has likely expired. Please generate a new Personal Access Token (PAT) on GitHub and update the git credentials on EC2."

**To fix (owner must do this):**

1. Generate a new GitHub PAT at: https://github.com/settings/tokens
   - Select "repo" scope for full repository access
   - Set expiration as desired

2. SSH into EC2 and update the git remote URL with the new token:
   ```bash
   cd ~/openclaw
   git remote set-url origin https://<NEW_TOKEN>@github.com/s260895/openclaw.git
   ```

3. Verify with: `git pull origin ec2-deploy`

**Note:** The owner controls GitHub token rotation. This skill cannot update tokens itself.

## Quick Commands

For brevity, define an alias variable (or just copy the full SSH prefix):

```bash
EC2_SSH="ssh -i $OPENCLAW_SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99"
```

### Check Server Health

```bash
# Gateway health endpoint (no SSH needed - always try this first)
curl -s https://openclaw.sumeetzankar.com/healthz

# Gateway container status
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml ps"

# WhatsApp channel status
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "cd ~/openclaw && docker compose exec -T openclaw-gateway openclaw channels status"

# System resources (memory, swap, disk)
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "free -h && df -h /"
```

### View Logs

```bash
# Recent gateway logs
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml logs --tail 100 openclaw-gateway"

# nginx access/error logs
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "sudo tail -50 /var/log/nginx/access.log"
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "sudo tail -50 /var/log/nginx/error.log"
```

### Restart Gateway

```bash
# Restart container (preserves config)
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "docker compose -f ~/openclaw/docker-compose.yml restart openclaw-gateway"
```

### Deploy Code Changes

```bash
# Pull latest code (no rebuild needed for most changes)
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "cd ~/openclaw && git pull origin ec2-deploy"

# Full rebuild (only if Dockerfile changed)
ssh -i "$OPENCLAW_SSH_KEY_PATH" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 ec2-user@16.58.140.99 "cd ~/openclaw && docker compose down && docker build -t openclaw:local . && docker compose up -d"
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
