# nginx and SSL Reference

## Configuration Files

| File | Purpose |
|------|---------|
| `/etc/nginx/nginx.conf` | Main nginx config |
| `/etc/nginx/conf.d/openclaw.conf` | OpenClaw reverse proxy config |
| `/etc/letsencrypt/live/openclaw.sumeetzankar.com/` | SSL certificates |

## Current nginx Config

Location: `/etc/nginx/conf.d/openclaw.conf`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name openclaw.sumeetzankar.com;
    # Certbot auto-redirects HTTP to HTTPS
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name openclaw.sumeetzankar.com;

    ssl_certificate /etc/letsencrypt/live/openclaw.sumeetzankar.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openclaw.sumeetzankar.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;

        # WebSocket support (CRITICAL)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeouts for WebSocket
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

## nginx Commands

```bash
# Test config syntax
sudo nginx -t

# Reload config (no downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

## SSL Certificate Management

### Certificate Details

```bash
# Check certificate expiry
sudo certbot certificates

# View certificate info
openssl x509 -in /etc/letsencrypt/live/openclaw.sumeetzankar.com/fullchain.pem -text -noout | head -20
```

### Manual Renewal

```bash
# Dry run (test without changing anything)
sudo certbot renew --dry-run

# Actual renewal
sudo certbot renew
```

### Auto-Renewal

A systemd timer handles monthly renewal:

```bash
# Check timer status
sudo systemctl status certbot-renewal.timer

# View timer schedule
sudo systemctl list-timers | grep certbot
```

Timer files:
- `/etc/systemd/system/certbot-renewal.service`
- `/etc/systemd/system/certbot-renewal.timer`

### Re-issue Certificate

If certificate is lost or corrupted:

```bash
sudo certbot --nginx -d openclaw.sumeetzankar.com
```

## Troubleshooting

### 502 Bad Gateway

Gateway container not running or not listening on 18789:

```bash
# Check container
docker compose ps

# Check port
ss -tlnp | grep 18789

# Restart gateway
docker compose restart openclaw-gateway
```

### WebSocket not connecting

Check nginx config has WebSocket headers:
- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`

### SSL certificate errors

```bash
# Check certificate validity
sudo certbot certificates

# Force renewal if needed
sudo certbot renew --force-renewal
```
