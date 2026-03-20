# Config and Data Locations Reference

All paths are on the EC2 instance unless noted.

## Directory Structure

```
/home/ec2-user/
├── openclaw/                         # Git repository
│   ├── docker-compose.yml            # Container orchestration
│   ├── Dockerfile                    # Image build instructions
│   ├── .env                          # Docker compose environment
│   ├── skills/                       # Bundled skills (including self-ops)
│   └── extensions/                   # Channel extensions (WhatsApp, etc.)
│
└── .openclaw/                        # Runtime config and data
    ├── openclaw.json                 # Main configuration file
    ├── credentials/                  # API credentials
    │   └── whatsapp/
    │       └── default/              # WhatsApp Baileys auth state
    ├── devices/                      # Paired devices
    │   └── paired.json
    ├── agents/                       # Agent configs
    │   └── main/
    │       └── agent/
    │           └── auth-profiles.json  # Anthropic API token
    ├── identity/                     # Device identity
    └── workspace/                    # Agent workspace
        └── skills/                   # Workspace-level skills
```

## Key Configuration Files

### Main Config: `~/.openclaw/openclaw.json`

Contains:
- Gateway settings (port, bind mode, auth token)
- Channel configs (WhatsApp allowlists, group policies)
- Agent defaults (model selection)
- Skills configuration
- Hooks settings

```bash
# View config
cat ~/.openclaw/openclaw.json

# Edit config (use caution)
nano ~/.openclaw/openclaw.json
```

### Docker Environment: `~/openclaw/.env`

```bash
OPENCLAW_CONFIG_DIR=/home/ec2-user/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/ec2-user/.openclaw/workspace
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_TZ=Asia/Kolkata
OPENCLAW_IMAGE=openclaw:local
```

### WhatsApp Auth State: `~/.openclaw/credentials/whatsapp/default/`

Contains Baileys multi-file auth state:
- Pre-keys
- Session data
- LID mappings

**CRITICAL**: Never delete or modify these files unless re-linking WhatsApp.

### Paired Devices: `~/.openclaw/devices/paired.json`

Lists all paired devices (browsers, CLI probes).

```bash
# View paired devices
docker compose exec openclaw-gateway openclaw devices list
```

### Anthropic API Token: `~/.openclaw/agents/main/agent/auth-profiles.json`

Contains the API key for Claude. Never expose this.

## Git Repository

| Property | Value |
|----------|-------|
| Local Path | `~/openclaw/` |
| Remote | https://github.com/s260895/openclaw |
| Branch | ec2-deploy |

```bash
# Check current branch
cd ~/openclaw && git branch

# Check remote
git remote -v

# Check status
git status
```

## Sensitive Files (Never Expose)

- `~/.openclaw/openclaw.json` - Contains gateway token
- `~/.openclaw/agents/main/agent/auth-profiles.json` - Anthropic API key
- `~/.openclaw/credentials/whatsapp/default/*` - WhatsApp session
- `~/openclaw/.env` - May contain secrets

## Backup Locations

To backup the full config:

```bash
# Create backup archive
tar -czvf openclaw-backup-$(date +%Y%m%d).tar.gz -C ~/.openclaw .
```

To restore:

```bash
# Extract backup
tar -xzvf openclaw-backup-YYYYMMDD.tar.gz -C ~/.openclaw
```
