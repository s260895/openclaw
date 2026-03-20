# EC2 Server Setup Reference

This documents how the EC2 instance was initially configured. Use this for rebuilding or troubleshooting.

## Instance Details

| Property | Value |
|----------|-------|
| Instance Type | t3.small (2 vCPU, 2GB RAM) |
| AMI | Amazon Linux 2023 (x86_64) |
| Storage | 20GB gp3 |
| Region | us-east-2 |
| Elastic IP | 16.58.140.99 |

## Initial Setup Commands

### 1. System Update

```bash
sudo yum update -y
sudo yum install -y git curl
```

### 2. Swap File (Critical for t3.small)

The instance only has 2GB RAM. A 2GB swap file prevents OOM during Docker builds.

```bash
# Create 2GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make persistent
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

### 3. Docker Installation

```bash
# Install Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Log out and back in for group to take effect
exit
# SSH back in

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verify
docker --version
docker compose version
```

### 4. nginx Installation

```bash
sudo yum install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Certbot Installation (via pip3)

```bash
sudo yum install -y python3-pip
sudo pip3 install certbot certbot-nginx
```

## Firewall

Firewall is managed via AWS Security Groups, NOT on the instance itself.

**Security Group Rules:**
| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Owner IP | SSH access (controlled by owner) |
| HTTP | 80 | 0.0.0.0/0 | Let's Encrypt validation |
| HTTPS | 443 | 0.0.0.0/0 | Public HTTPS access |

Port 18789 is NOT exposed - nginx proxies to it internally.

## Directory Structure

```
/home/ec2-user/
├── openclaw/                    # Git repo clone
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── .env                     # Docker compose env vars
│   └── ...
└── .openclaw/                   # OpenClaw config
    ├── openclaw.json
    ├── credentials/
    ├── devices/
    └── workspace/
```

## Verification Commands

```bash
# Check swap is active
free -h

# Check Docker is running
sudo systemctl status docker

# Check nginx is running
sudo systemctl status nginx

# Check disk space
df -h

# Check system load
uptime
```
