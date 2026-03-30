# 🤖 AI Monitoring Agent

A comprehensive Playwright-based monitoring system that acts as an AI agent for observing, diagnosing, and reporting issues on web applications.

## Features

- ✅ **Full Observability** - Captures console errors, network failures, HTTP errors, page errors
- ✅ **User Journey Simulation** - Simulates real user flows with screenshots
- ✅ **Automated JSON Reports** - Detailed reporting with performance metrics
- ✅ **Retry Logic** - Exponential backoff for flaky tests (up to 3 retries)
- ✅ **Self-Healing Actions** - Automatic recovery from common issues
- ✅ **Multiple App Support** - Monitors both IELTS Fast and ProMedic1 platforms

## Quick Start

### 1. Install Dependencies

```bash
cd /root/monitoring-agent
npm install
npx playwright install chromium
```

### 2. Run Monitoring

```bash
# Monitor both apps
npm run monitor:all

# Monitor only IELTS Fast
npm run monitor:ielts

# Monitor only ProMedic1
npm run monitor:promedic

# Run with visible browser (for debugging)
node monitor.js --app=ielts --headed

# Run specific flow
node monitor.js --app=ielts --flow=vocabulary_exploration
```

### 3. View Reports

Reports are saved in `./reports/` directory:

```bash
# View latest report
cat reports/ielts_latest.json | jq

# Serve reports with web server
npm run report:serve
```

## User Flows Tested

### IELTS Fast (ielts.fast)

1. **vocabulary_exploration** - Navigate to vocabulary section and explore
2. **reading_section_check** - Check reading section functionality
3. **speaking_practice_check** - Verify speaking section loads
4. **writing_section_check** - Check writing section input
5. **listening_section_check** - Check listening section audio player

### ProMedic1 (promedic1.com)

1. **homepage_and_apps_check** - Verify homepage loads and app links work
2. **clinical_app_check** - Verify clinical app is accessible
3. **diet_app_check** - Verify diet app is accessible
4. **coach_app_check** - Verify coach app is accessible
5. **cross_domain_integrity** - Ensure ielts.fast is separate from promedic1.com

## Self-Healing Actions

The agent automatically attempts to fix these issues:

| Issue | Healing Action |
|-------|----------------|
| Session expired | Clear cookies and retry |
| Element not found | Wait 5s for JS loading |
| 503/502/504 errors | Wait 30s for server recovery |
| Navigation errors | Retry navigation |

## Report Structure

```json
{
  "run_timestamp": "2026-03-30T12:00:00.000Z",
  "app": "ielts",
  "overall_status": "PASS / FAIL / PARTIAL",
  "summary": {
    "total_flows": 5,
    "passed_flows": 5,
    "failed_flows": 0,
    "total_steps": 20,
    "passed_steps": 20
  },
  "flows": [...],
  "aggregated_issues": {
    "console_errors": [...],
    "network_failures": [...],
    "slow_requests": [...]
  },
  "performance": {
    "total_time_ms": 45000,
    "slowest_requests": [...]
  },
  "recommendations": [...]
}
```

## Setting Up Cron Job (Continuous Monitoring)

### Option 1: Using setup-cron.js (Recommended)

```bash
node setup-cron.js
```

This will create a cron job that runs every 15 minutes.

### Option 2: Manual Cron Setup

```bash
# Edit crontab
crontab -e

# Add these lines (runs every 15 minutes)
*/15 * * * * cd /root/monitoring-agent && /usr/bin/node monitor.js --app=all >> /root/monitoring-agent/logs/cron.log 2>&1

# Or run specific apps at different intervals:
# IELTS every 15 minutes
*/15 * * * * cd /root/monitoring-agent && /usr/bin/node monitor.js --app=ielts >> /root/monitoring-agent/logs/ielts.log 2>&1

# ProMedic every 30 minutes
*/30 * * * * cd /root/monitoring-agent && /usr/bin/node monitor.js --app=promedic >> /root/monitoring-agent/logs/promedic.log 2>&1

# Daily full report at 8 AM
0 8 * * * cd /root/monitoring-agent && /usr/bin/node monitor.js --app=all && /usr/bin/node send-report.js
```

### Viewing Cron Logs

```bash
# View latest cron output
tail -f /root/monitoring-agent/logs/cron.log

# View all logs
ls -la /root/monitoring-agent/logs/
```

## Directory Structure

```
monitoring-agent/
├── config.js              # App configurations
├── monitor.js             # Main monitoring script
├── setup-cron.js          # Cron setup utility
├── send-report.js         # Email notification script
├── package.json           # Dependencies
├── README.md             # This file
├── screenshots/          # Screenshots organized by date
│   └── 20260330_120000/
├── reports/              # JSON reports
│   ├── ielts_latest.json
│   ├── promedic_latest.json
│   └── ielts_report_20260330_120000.json
└── logs/                 # Cron execution logs
    ├── cron.log
    ├── ielts.log
    └── promedic.log
```

## Environment Variables

Create a `.env` file for email notifications:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=admin@promedic1.com
```

## Customizing Flows

Edit `config.js` to add/modify user flows:

```javascript
flows: [
  {
    name: 'my_custom_flow',
    description: 'Test custom functionality',
    steps: [
      { action: 'navigate', path: '/custom-page', name: 'load_page' },
      { action: 'click', selector: '#my-button', name: 'click_button' },
      { action: 'fill', selector: '#input', value: 'test', name: 'fill_input' },
      { action: 'assert-text', selector: 'h1', expected: ['Success'], name: 'verify_success' }
    ]
  }
]
```

### Available Step Actions

| Action | Description | Options |
|--------|-------------|---------|
| `navigate` | Navigate to URL | `path`, `url` |
| `click` | Click element | `selector`, `fallback` |
| `fill` | Fill input field | `selector`, `value` |
| `wait` | Wait for element or delay | `selector`, `delay`, `timeout` |
| `screenshot` | Take screenshot | - |
| `scroll` | Scroll page | `distance` |
| `assert-text` | Verify text on page | `selector`, `expected`, `notExpected` |
| `check-element` | Verify element exists | `selector`, `optional` |

## Troubleshooting

### Browser won't launch

```bash
# Install Playwright dependencies
npx playwright install-deps chromium

# Or install system dependencies manually
apt-get install -y libnss3 libatk-bridge2.0-0 libxss1 libgtk-3-0
```

### Out of disk space (screenshots)

```bash
# Add to crontab to clean old screenshots
0 0 * * * find /root/monitoring-agent/screenshots -type d -mtime +7 -exec rm -rf {} \;
```

### Tests are flaky

Increase retry count and delays in `config.js`:

```javascript
settings: {
  retries: 5,
  retryDelay: 10000,
  // ...
}
```

## License

MIT - ProMedic Healthcare Platform
