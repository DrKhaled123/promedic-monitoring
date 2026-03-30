# 🚀 AI Monitoring Agent - Quick Start

## ✅ Installation Complete

Your AI Monitoring Agent is now set up and configured!

## What's Installed

| Component | Location | Status |
|-----------|----------|--------|
| Main Script | `/root/monitoring-agent/monitor.js` | ✅ Ready |
| Config | `/root/monitoring-agent/config.js` | ✅ Ready |
| Reports | `/root/monitoring-agent/reports/` | ✅ Ready |
| Screenshots | `/root/monitoring-agent/screenshots/` | ✅ Ready |
| Cron Job | Runs every 15 min | ✅ Active |

## Current Test Results

### ProMedic1 (promedic1.com)
```
Overall Status: ✅ PASS
Flows: 5/5 passed
Steps: 26/26 passed
Total Time: 58.62s
```

**Passing Flows:**
- ✅ homepage_and_apps_check
- ✅ clinical_app_check
- ✅ diet_app_check  
- ✅ coach_app_check
- ✅ cross_domain_integrity (verifies ielts.fast ≠ promedic1.com)

### IELTS Fast (ielts.fast)
```
Overall Status: ⚠️ PARTIAL
Flows: 1/5 passed (vocabulary exploration works!)
```

**Note:** Some IELTS tests fail due to generic selectors. Customize `config.js` with your actual page selectors for full coverage.

## Quick Commands

```bash
# Run monitoring now
cd /root/monitoring-agent && node monitor.js --app=all

# Check latest reports
cat /root/monitoring-agent/reports/promedic_latest.json | jq '.summary'
cat /root/monitoring-agent/reports/ielts_latest.json | jq '.summary'

# View cron logs
tail -f /root/monitoring-agent/logs/cron.log

# View screenshots
ls -la /root/monitoring-agent/screenshots/

# Edit configuration
nano /root/monitoring-agent/config.js

# Remove cron job
crontab -r
```

## Report Structure

Reports are saved as JSON in `/root/monitoring-agent/reports/`:

```json
{
  "run_timestamp": "2026-03-30T12:34:57.000Z",
  "overall_status": "PASS",
  "summary": {
    "total_flows": 5,
    "passed_flows": 5,
    "failed_flows": 0
  },
  "flows": [...],
  "aggregated_issues": {
    "console_errors": [],
    "network_failures": [],
    "slow_requests": []
  },
  "recommendations": []
}
```

## Self-Healing Features Active

The agent automatically:
- 🔄 Retries failed steps (3 attempts with exponential backoff)
- 🧹 Clears cookies on session expiry
- ⏱️ Waits for JS loading delays
- 🌐 Waits for server recovery (503/502 errors)

## Customizing for IELTS App

Edit `/root/monitoring-agent/config.js` and update selectors:

```javascript
// Current (generic)
{ action: 'wait', selector: 'article, .reading-content, .passage', ... }

// Change to match your actual app
{ action: 'wait', selector: '.reading-section, [data-testid="reading"]', ... }
```

## Notification Setup (Optional)

```bash
# Create .env file
cat > /root/monitoring-agent/.env << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
ALERT_EMAIL=admin@promedic1.com
EOF

# Test email
node /root/monitoring-agent/send-report.js
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Browser won't start | `npx playwright install-deps chromium` |
| Out of disk space | `find screenshots/ -mtime +7 -delete` |
| Tests too flaky | Increase `retries` in config.js |
| Cron not running | Check `tail -f /var/log/syslog \| grep CRON` |

## Files Overview

```
/root/monitoring-agent/
├── monitor.js          # Main monitoring script
├── config.js           # App configurations
├── setup-cron.js       # Cron setup utility
├── send-report.js      # Email notifications
├── package.json        # Dependencies
├── README.md           # Full documentation
├── QUICKSTART.md       # This file
├── .env.example        # Environment template
├── screenshots/        # Captured screenshots
│   └── 20260330_123457/
├── reports/            # JSON reports
│   ├── ielts_latest.json
│   ├── promedic_latest.json
│   └── ...
└── logs/               # Cron execution logs
    └── cron.log
```

## Next Steps

1. ✅ Monitoring is running every 15 minutes
2. 📊 Check reports in `/root/monitoring-agent/reports/`
3. 🖼️ View screenshots to see what the agent sees
4. ⚙️ Customize IELTS selectors for full coverage
5. 📧 Set up email alerts (optional)

---

**Server:** promedic1.com (46.62.228.173)  
**Setup Date:** 2026-03-30  
**Status:** ✅ Active & Monitoring
