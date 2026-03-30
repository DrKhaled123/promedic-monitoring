#!/usr/bin/env node
/**
 * Email Notification Script for Monitoring Reports
 * Sends summary of latest monitoring results
 */

const fs = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const config = require('./config');

async function sendReport() {
  // Check if email is configured
  if (!config.settings.notifications.enabled || !process.env.SMTP_HOST) {
    console.log('Email notifications not configured. Set SMTP_HOST in .env');
    return;
  }

  const reportsDir = './reports';
  
  // Read latest reports
  const reports = [];
  for (const app of Object.keys(config.apps)) {
    const reportPath = path.join(reportsDir, `${app}_latest.json`);
    if (fs.existsSync(reportPath)) {
      reports.push({
        app,
        data: fs.readJsonSync(reportPath)
      });
    }
  }

  if (reports.length === 0) {
    console.log('No reports found to send');
    return;
  }

  // Create email content
  const subject = `🤖 Monitoring Report - ${new Date().toLocaleDateString()}`;
  
  let html = `
    <h1>🤖 AI Monitoring Agent Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <hr>
  `;

  let hasIssues = false;

  for (const { app, data } of reports) {
    const statusColor = data.overall_status === 'PASS' ? '#28a745' : 
                        data.overall_status === 'FAIL' ? '#dc3545' : '#ffc107';
    
    if (data.overall_status !== 'PASS') hasIssues = true;

    html += `
      <h2>${config.apps[app].name}</h2>
      <p><strong>Status:</strong> <span style="color: ${statusColor}; font-size: 18px;">${data.overall_status}</span></p>
      <p><strong>Flows:</strong> ${data.summary.passed_flows}/${data.summary.total_flows} passed</p>
      <p><strong>Steps:</strong> ${data.summary.passed_steps}/${data.summary.total_steps} passed</p>
      <p><strong>Duration:</strong> ${(data.performance.total_time_ms / 1000).toFixed(2)}s</p>
      
      ${data.aggregated_issues.console_errors.length > 0 ? `
        <p style="color: #ffc107;">⚠️ Console Errors: ${data.aggregated_issues.console_errors.length}</p>
      ` : ''}
      
      ${data.aggregated_issues.network_failures.length > 0 ? `
        <p style="color: #dc3545;">🚨 Network Failures: ${data.aggregated_issues.network_failures.length}</p>
      ` : ''}
      
      ${data.recommendations.length > 0 ? `
        <h4>Recommendations:</h4>
        <ul>
          ${data.recommendations.map(r => `<li><strong>[${r.severity.toUpperCase()}]</strong> ${r.message}</li>`).join('')}
        </ul>
      ` : ''}
      
      <hr>
    `;
  }

  // Add link to reports
  html += `
    <p>View full reports on server:</p>
    <pre>cd /root/monitoring-agent && ls -la reports/</pre>
  `;

  // Send email
  const transporter = nodemailer.createTransport(config.settings.notifications.email.smtp);

  try {
    await transporter.sendMail({
      from: config.settings.notifications.email.from,
      to: config.settings.notifications.email.to,
      subject: hasIssues ? `🚨 ${subject}` : `✅ ${subject}`,
      html
    });
    console.log('Email report sent successfully');
  } catch (error) {
    console.error('Failed to send email:', error.message);
  }
}

sendReport().catch(console.error);
