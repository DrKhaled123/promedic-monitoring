#!/usr/bin/env node
/**
 * Cron Job Setup Utility
 * Sets up automated monitoring with cron
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     🤖 AI Monitoring Agent - Cron Setup                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const baseDir = '/root/monitoring-agent';
  
  // Check if running in correct directory
  if (!fs.existsSync(path.join(baseDir, 'monitor.js'))) {
    console.error('Error: Please run this script from /root/monitoring-agent directory');
    process.exit(1);
  }

  console.log('Current cron jobs:');
  try {
    const currentCrontab = execSync('crontab -l 2>/dev/null || echo "No crontab"', { encoding: 'utf8' });
    console.log(currentCrontab.includes('monitor.js') ? currentCrontab : '(No monitoring jobs set)\n');
  } catch (e) {
    console.log('(No crontab exists yet)\n');
  }

  // Get configuration
  const interval = await question('Monitoring interval (15/30/60 minutes) [15]: ') || '15';
  const apps = await question('Apps to monitor (ielts/promedic/all) [all]: ') || 'all';
  const headless = await question('Run headless? (y/n) [y]: ') || 'y';
  const enableEmail = await question('Enable email alerts? (y/n) [n]: ') || 'n';

  // Build cron command
  const nodePath = execSync('which node', { encoding: 'utf8' }).trim();
  const logFile = path.join(baseDir, 'logs', 'cron.log');
  
  // Ensure logs directory exists
  fs.ensureDirSync(path.dirname(logFile));

  let cronCommand = `cd ${baseDir} && ${nodePath} monitor.js --app=${apps}`;
  if (headless === 'n') {
    cronCommand += ' --headed';
  }
  cronCommand += ` >> ${logFile} 2>&1`;

  // Calculate cron timing
  const intervalNum = parseInt(interval);
  const cronTiming = intervalNum === 60 ? '0 * * * *' : `*/${interval} * * * *`;

  // Build full crontab
  const cronEntry = `${cronTiming} ${cronCommand}`;
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     Configuration Summary                              ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`  Interval: Every ${interval} minutes`);
  console.log(`  Apps: ${apps}`);
  console.log(`  Headless: ${headless === 'y' ? 'Yes' : 'No'}`);
  console.log(`  Email Alerts: ${enableEmail === 'y' ? 'Yes' : 'No'}`);
  console.log(`  Cron Entry: ${cronTiming} ...`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const confirm = await question('Apply this configuration? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    return;
  }

  try {
    // Get existing crontab
    let existingCrontab = '';
    try {
      existingCrontab = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
    } catch (e) {
      // No existing crontab
    }

    // Remove old monitoring entries
    const lines = existingCrontab.split('\n').filter(line => 
      !line.includes('monitor.js') && 
      !line.includes('AI Monitoring Agent')
    );

    // Add header and new entry
    const newCrontab = [
      '# AI Monitoring Agent - Auto-generated',
      `# Updated: ${new Date().toISOString()}`,
      `MAILTO=""`,
      ...lines,
      '',
      '# Monitoring jobs',
      cronEntry
    ].join('\n');

    // Install new crontab
    const tmpFile = '/tmp/crontab_tmp';
    fs.writeFileSync(tmpFile, newCrontab);
    execSync(`crontab ${tmpFile}`);
    fs.unlinkSync(tmpFile);

    console.log('\n✅ Cron job installed successfully!');
    console.log(`\nNext runs (every ${interval} minutes):`);
    
    // Show upcoming times
    const now = new Date();
    for (let i = 1; i <= 5; i++) {
      const nextRun = new Date(now.getTime() + i * intervalNum * 60 * 1000);
      console.log(`  ${i}. ${nextRun.toLocaleString()}`);
    }

    console.log('\nCommands to manage:');
    console.log(`  View logs:     tail -f ${logFile}`);
    console.log(`  View reports:  ls ${baseDir}/reports/`);
    console.log(`  Edit cron:     crontab -e`);
    console.log(`  View cron:     crontab -l`);
    console.log(`  Remove cron:   crontab -r`);
    console.log(`  Run now:       cd ${baseDir} && node monitor.js --app=${apps}`);

    if (enableEmail === 'y') {
      console.log('\n⚠️  Email alerts require SMTP configuration in .env file');
      console.log('   See README.md for environment variable setup');
    }

  } catch (error) {
    console.error('\n❌ Failed to install cron job:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();
