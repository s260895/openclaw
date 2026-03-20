# Docker Operations Reference

All Docker commands should be run from the `~/openclaw` directory on EC2.

## Container Management

### View Status

```bash
# Container status
docker compose ps

# Detailed container info
docker compose ps -a

# Container resource usage
docker stats --no-stream
```

### Start/Stop/Restart

```bash
# Start gateway
docker compose up -d openclaw-gateway

# Stop gateway
docker compose down

# Restart gateway (preserves volumes)
docker compose restart openclaw-gateway

# Force recreate container
docker compose up -d --force-recreate openclaw-gateway
```

### Logs

```bash
# Recent logs
docker compose logs --tail 100 openclaw-gateway

# Follow logs in real-time
docker compose logs -f openclaw-gateway

# Logs with timestamps
docker compose logs -t openclaw-gateway

# Filter by time
docker compose logs --since 1h openclaw-gateway
```

### Execute Commands Inside Container

```bash
# Interactive shell
docker compose exec openclaw-gateway /bin/sh

# Run openclaw CLI commands
docker compose exec openclaw-gateway openclaw channels status
docker compose exec openclaw-gateway openclaw skills list
docker compose exec openclaw-gateway openclaw devices list

# Check node version
docker compose exec openclaw-gateway node --version
```

## Image Management

### Rebuild Image

**Only needed when Dockerfile changes.** Takes 10+ minutes on t3.small.

```bash
# Stop, rebuild, start
docker compose down
docker build -t openclaw:local .
docker compose up -d

# Or one-liner
docker compose down && docker build -t openclaw:local . && docker compose up -d
```

### Clean Up

```bash
# Remove unused images
docker image prune -f

# Remove unused volumes (CAUTION: data loss)
docker volume prune -f

# Full cleanup (CAUTION)
docker system prune -af
```

## Environment Variables

The `.env` file in `~/openclaw/` contains Docker Compose variables:

```bash
OPENCLAW_CONFIG_DIR=/home/ec2-user/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/ec2-user/.openclaw/workspace
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_TZ=Asia/Kolkata
OPENCLAW_IMAGE=openclaw:local
```

## Health Checks

```bash
# Container health status
docker inspect --format='{{.State.Health.Status}}' openclaw-openclaw-gateway-1

# HTTP health check
curl -s http://127.0.0.1:18789/healthz

# HTTPS health check (via nginx)
curl -s https://openclaw.sumeetzankar.com/healthz
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker compose logs openclaw-gateway

# Check if port is in use
ss -tlnp | grep 18789

# Check Docker daemon
sudo systemctl status docker
```

### Out of memory

```bash
# Check memory usage
free -h

# Check if swap is active
swapon --show

# Check container memory
docker stats --no-stream
```

### Disk full

```bash
# Check disk usage
df -h

# Docker disk usage
docker system df

# Clean up Docker
docker system prune -f
```
