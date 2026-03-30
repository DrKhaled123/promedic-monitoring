#!/usr/bin/env node
/**
 * AI Monitoring Agent - Playwright-based Web Application Monitor
 * 
 * Features:
 * - Full observability (console, network, JS errors)
 * - User journey simulation with screenshots
 * - Automated JSON reporting
 * - Retry logic with exponential backoff
 * - Self-healing actions for recoverable errors
 */

const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { format } = require('date-fns');
const { Command } = require('commander');
const config = require('./config');

const program = new Command();
program
  .option('--app <app>', 'Application to monitor (ielts, promedic, or all)', 'all')
  .option('--flow <flow>', 'Specific flow to run (optional)')
  .option('--headless', 'Run in headless mode', true)
  .option('--headed', 'Run in headed mode (visible browser)')
  .option('--retries <n>', 'Number of retries for failed steps', '3')
  .option('--output <dir>', 'Output directory for reports', './reports')
  .parse();

const opts = program.opts();

// ============================================
// OBSERVABILITY & LOGGING
// ============================================

class ObservabilityCollector {
  constructor() {
    this.consoleLogs = [];
    this.networkFailures = [];
    this.httpErrors = [];
    this.slowRequests = [];
    this.pageErrors = [];
    this.networkRequests = [];
  }

  attachToPage(page) {
    // Console messages
    page.on('console', msg => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      };
      this.consoleLogs.push(entry);
      
      if (msg.type() === 'error') {
        console.log(chalk.red(`   🚨 Console Error: ${msg.text().substring(0, 100)}`));
      }
    });

    // Page errors
    page.on('pageerror', err => {
      const entry = {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      };
      this.pageErrors.push(entry);
      console.log(chalk.red(`   🚨 Page Error: ${err.message}`));
    });

    // Network failures
    page.on('requestfailed', req => {
      const entry = {
        url: req.url(),
        failure: req.failure()?.errorText || 'unknown',
        timestamp: new Date().toISOString()
      };
      this.networkFailures.push(entry);
      console.log(chalk.yellow(`   ⚠️  Network Fail: ${req.url()} - ${entry.failure}`));
    });

    // Response tracking
    page.on('response', async res => {
      const startTime = res.request().timing()?.startTime || Date.now();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const entry = {
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        responseTime,
        timestamp: new Date().toISOString()
      };
      this.networkRequests.push(entry);

      // HTTP errors (4xx, 5xx)
      if (res.status() >= 400) {
        this.httpErrors.push(entry);
        console.log(chalk.red(`   🚨 HTTP Error: ${res.status()} ${res.url()}`));
      }

      // Slow requests
      if (responseTime > config.settings.slowRequestThreshold) {
        this.slowRequests.push(entry);
        console.log(chalk.yellow(`   🐌 Slow Request: ${responseTime}ms - ${res.url()}`));
      }
    });
  }

  getReport() {
    return {
      console_errors: this.consoleLogs.filter(l => l.type === 'error'),
      console_warnings: this.consoleLogs.filter(l => l.type === 'warning'),
      network_failures: this.networkFailures,
      http_errors: this.httpErrors,
      slow_requests: this.slowRequests,
      page_errors: this.pageErrors,
      total_requests: this.networkRequests.length
    };
  }
}

// ============================================
// SELF-HEALING ACTIONS
// ============================================

class SelfHealingEngine {
  constructor(page, context) {
    this.page = page;
    this.context = context;
    this.healingActions = [];
  }

  async attemptHeal(error, step) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorText = error.toString().toLowerCase();
    
    // Heal: Session expired - clear cookies and retry
    if (errorMessage.includes('session') || errorMessage.includes('expired') || errorMessage.includes('unauthorized')) {
      console.log(chalk.blue('   🔧 Self-healing: Clearing cookies due to session expiry'));
      await this.context.clearCookies();
      this.healingActions.push({ type: 'clear_cookies', reason: 'session_expired', step: step.name });
      return true;
    }

    // Heal: Element not found - wait for JS loading
    if (errorMessage.includes('timeout') || errorMessage.includes('selector') || errorMessage.includes('element')) {
      console.log(chalk.blue(`   🔧 Self-healing: Waiting ${config.settings.selfHealing.waitForJSDelay}ms for JS to load`));
      await this.page.waitForTimeout(config.settings.selfHealing.waitForJSDelay);
      this.healingActions.push({ type: 'wait_for_js', reason: 'element_not_found', step: step.name });
      return true;
    }

    // Heal: Server errors (503, 502) - wait longer
    if (errorText.includes('503') || errorText.includes('502') || errorText.includes('504')) {
      console.log(chalk.blue(`   🔧 Self-healing: Server error detected, waiting ${config.settings.selfHealing.serverErrorRetryDelay}ms`));
      await this.page.waitForTimeout(config.settings.selfHealing.serverErrorRetryDelay);
      this.healingActions.push({ type: 'wait_server_recovery', reason: 'server_error', step: step.name });
      return true;
    }

    // Heal: Navigation errors - retry navigation
    if (errorMessage.includes('net::') || errorMessage.includes('navigation')) {
      console.log(chalk.blue('   🔧 Self-healing: Navigation error, will retry'));
      this.healingActions.push({ type: 'retry_navigation', reason: 'navigation_failed', step: step.name });
      return true;
    }

    return false;
  }

  getActions() {
    return this.healingActions;
  }
}

// ============================================
// STEP EXECUTOR
// ============================================

class StepExecutor {
  constructor(page, context, collector, appKey) {
    this.page = page;
    this.context = context;
    this.collector = collector;
    this.appKey = appKey;
    this.healing = new SelfHealingEngine(page, context);
  }

  async execute(step, flowName, screenshotDir) {
    const stepStart = Date.now();
    let status = 'PASS';
    let error = null;
    let screenshotPath = null;
    let htmlSnapshot = null;

    try {
      console.log(chalk.cyan(`   ▶️  Step: ${step.name}`));

      // Take screenshot before action
      if (config.settings.screenshots.enabled) {
        screenshotPath = path.join(screenshotDir, `${flowName}_${step.name}_before.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: config.settings.screenshots.fullPage });
      }

      // Execute action based on type
      await this.executeAction(step);

      // Take screenshot after action
      if (config.settings.screenshots.enabled) {
        screenshotPath = path.join(screenshotDir, `${flowName}_${step.name}_after.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: config.settings.screenshots.fullPage });
      }

      console.log(chalk.green(`   ✅ Step passed: ${step.name}`));

    } catch (err) {
      status = 'FAIL';
      error = err;
      console.log(chalk.red(`   ❌ Step failed: ${step.name} - ${err.message}`));

      // Capture diagnostic info
      try {
        htmlSnapshot = await this.page.content();
        screenshotPath = path.join(screenshotDir, `${flowName}_${step.name}_error.png`);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (e) {
        // Ignore screenshot errors
      }

      // Attempt self-healing
      const healed = await this.healing.attemptHeal(err, step);
      if (healed) {
        throw new HealingAttemptedError(err, step);
      }
    }

    const duration = Date.now() - stepStart;

    return {
      step: step.name,
      status,
      duration_ms: duration,
      error: error?.message,
      stack: error?.stack,
      screenshot: screenshotPath ? path.basename(screenshotPath) : null,
      html_snapshot: htmlSnapshot ? `${flowName}_${step.name}_error.html` : null,
      console_errors: this.collector.consoleLogs.filter(l => l.type === 'error').slice(-5)
    };
  }

  async executeAction(step) {
    // Get app config for base URL
    const appKey = this.appKey || 'ielts';
    const appConfig = config.apps[appKey];
    
    switch (step.action) {
      case 'navigate':
        let url;
        if (step.path.startsWith('http')) {
          url = step.path;
        } else if (appConfig?.baseURL) {
          url = `${appConfig.baseURL}${step.path}`;
        } else {
          url = step.path;
        }
        await this.page.goto(url, { waitUntil: 'networkidle', timeout: config.settings.pageLoadTimeout });
        break;

      case 'click':
        const clickSelector = await this.findElement(step.selector, step.fallback);
        await this.page.click(clickSelector, { timeout: config.settings.elementTimeout });
        break;

      case 'fill':
        await this.page.fill(step.selector, step.value, { timeout: config.settings.elementTimeout });
        break;

      case 'wait':
        if (step.selector) {
          await this.page.waitForSelector(step.selector, { timeout: step.timeout || config.settings.elementTimeout });
        } else if (step.delay) {
          await this.page.waitForTimeout(step.delay);
        }
        break;

      case 'screenshot':
        // Handled in main execute method
        break;

      case 'scroll':
        await this.page.evaluate((distance) => window.scrollBy(0, distance), step.distance || 500);
        await this.page.waitForTimeout(500);
        break;

      case 'assert-text':
        const bodyText = await this.page.locator('body').innerText();
        const found = step.expected.some(text => bodyText.toLowerCase().includes(text.toLowerCase()));
        if (!found) {
          throw new Error(`Expected text not found. Expected one of: ${step.expected.join(', ')}`);
        }
        if (step.notExpected) {
          const unwantedFound = step.notExpected.some(text => bodyText.toLowerCase().includes(text.toLowerCase()));
          if (unwantedFound) {
            throw new Error(`Unwanted text found. Should NOT contain: ${step.notExpected.join(', ')}`);
          }
        }
        break;

      case 'check-element':
        const exists = await this.page.locator(step.selector).first().isVisible().catch(() => false);
        if (!exists && !step.optional) {
          throw new Error(`Required element not found: ${step.selector}`);
        }
        break;

      default:
        console.log(chalk.yellow(`   ⚠️  Unknown action: ${step.action}`));
    }
  }

  async findElement(primary, fallback) {
    const exists = await this.page.locator(primary).first().isVisible().catch(() => false);
    if (exists) return primary;
    if (fallback) {
      const fallbackExists = await this.page.locator(fallback).first().isVisible().catch(() => false);
      if (fallbackExists) return fallback;
    }
    return primary;
  }
}

class HealingAttemptedError extends Error {
  constructor(originalError, step) {
    super(`Healing attempted for: ${originalError.message}`);
    this.originalError = originalError;
    this.step = step;
    this.isHealingAttempted = true;
  }
}

// ============================================
// FLOW RUNNER
// ============================================

class FlowRunner {
  constructor(appConfig, appName) {
    this.appConfig = appConfig;
    this.appName = appName;
    this.results = [];
    this.appKey = appName;
  }

  async run(browser, screenshotDir) {
    console.log(chalk.bold.blue(`\n🚀 Running flows for: ${this.appConfig.name}`));
    
    for (const flow of this.appConfig.flows) {
      const flowResult = await this.runFlow(flow, browser, screenshotDir);
      this.results.push(flowResult);
    }

    return this.results;
  }

  async runFlow(flow, browser, screenshotDir) {
    console.log(chalk.bold(`\n📋 Flow: ${flow.name} - ${flow.description}`));
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AI-Monitoring-Agent/1.0',
      baseURL: this.appConfig.baseURL
    });

    const page = await context.newPage();
    const collector = new ObservabilityCollector();
    collector.attachToPage(page);

    const stepResults = [];
    const flowStart = Date.now();

    try {
      for (const step of flow.steps) {
        const executor = new StepExecutor(page, context, collector, this.appKey);
        
        // Retry logic
        let attempt = 0;
        let result = null;
        let lastError = null;
        
        while (attempt < config.settings.retries) {
          try {
            result = await executor.execute(step, flow.name, screenshotDir);
            break;
          } catch (err) {
            lastError = err;
            attempt++;
            
            if (err.isHealingAttempted && attempt < config.settings.retries) {
              console.log(chalk.blue(`   🔄 Retrying after healing (attempt ${attempt + 1}/${config.settings.retries})`));
              const delay = config.settings.exponentialBackoff 
                ? config.settings.retryDelay * Math.pow(2, attempt - 1)
                : config.settings.retryDelay;
              await page.waitForTimeout(delay);
              continue;
            }
            
            if (attempt < config.settings.retries) {
              console.log(chalk.yellow(`   🔄 Retry ${attempt}/${config.settings.retries} after ${config.settings.retryDelay}ms`));
              await page.waitForTimeout(config.settings.retryDelay);
            }
          }
        }

        if (!result) {
          result = {
            step: step.name,
            status: 'FAIL',
            error: lastError?.message,
            stack: lastError?.stack,
            duration_ms: 0
          };
        }

        stepResults.push(result);

        // Stop flow on critical failure
        if (result.status === 'FAIL' && !step.optional) {
          console.log(chalk.red(`   ⛔ Critical step failed, stopping flow`));
          break;
        }
      }
    } finally {
      await context.close();
    }

    const flowDuration = Date.now() - flowStart;
    const failedSteps = stepResults.filter(s => s.status === 'FAIL');
    
    return {
      flow_name: flow.name,
      description: flow.description,
      status: failedSteps.length === 0 ? 'PASS' : failedSteps.length === stepResults.length ? 'FAIL' : 'PARTIAL',
      duration_ms: flowDuration,
      steps: stepResults,
      observability: collector.getReport()
    };
  }
}

// ============================================
// REPORT GENERATOR
// ============================================

class ReportGenerator {
  static generate(results, appName, startTime, endTime) {
    const allSteps = results.flatMap(r => r.steps);
    const failedSteps = allSteps.filter(s => s.status === 'FAIL');
    const passedSteps = allSteps.filter(s => s.status === 'PASS');
    
    const allObservability = results.map(r => r.observability);
    const allConsoleErrors = allObservability.flatMap(o => o.console_errors);
    const allNetworkFailures = allObservability.flatMap(o => o.network_failures);
    const allSlowRequests = allObservability.flatMap(o => o.slow_requests);

    const report = {
      run_timestamp: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      app: appName,
      overall_status: failedSteps.length === 0 ? 'PASS' : passedSteps.length === 0 ? 'FAIL' : 'PARTIAL',
      summary: {
        total_flows: results.length,
        passed_flows: results.filter(r => r.status === 'PASS').length,
        failed_flows: results.filter(r => r.status === 'FAIL').length,
        partial_flows: results.filter(r => r.status === 'PARTIAL').length,
        total_steps: allSteps.length,
        passed_steps: passedSteps.length,
        failed_steps: failedSteps.length
      },
      flows: results,
      aggregated_issues: {
        console_errors: allConsoleErrors,
        network_failures: allNetworkFailures,
        slow_requests: allSlowRequests
      },
      performance: {
        total_time_ms: endTime - startTime,
        slowest_requests: allSlowRequests
          .sort((a, b) => b.responseTime - a.responseTime)
          .slice(0, 10)
      },
      recommendations: this.generateRecommendations(results, allConsoleErrors, allNetworkFailures)
    };

    return report;
  }

  static generateRecommendations(results, consoleErrors, networkFailures) {
    const recommendations = [];

    if (consoleErrors.length > 0) {
      recommendations.push({
        type: 'console_errors',
        severity: 'medium',
        message: `${consoleErrors.length} console errors detected. Review JavaScript code for issues.`,
        action: 'Check browser console for detailed error messages'
      });
    }

    if (networkFailures.length > 0) {
      recommendations.push({
        type: 'network_issues',
        severity: 'high',
        message: `${networkFailures.length} network failures detected.`,
        action: 'Check server availability and network connectivity'
      });
    }

    const failedFlows = results.filter(r => r.status === 'FAIL');
    if (failedFlows.length > 0) {
      recommendations.push({
        type: 'flow_failures',
        severity: 'critical',
        message: `${failedFlows.length} flows completely failed.`,
        action: `Review failed flows: ${failedFlows.map(f => f.flow_name).join(', ')}`
      });
    }

    return recommendations;
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const startTime = Date.now();
  
  console.log(chalk.bold.green('╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.green('║     🤖 AI Monitoring Agent - Starting Up               ║'));
  console.log(chalk.bold.green('╚════════════════════════════════════════════════════════╝'));

  const appToRun = opts.app;
  const headless = opts.headed ? false : true;

  // Ensure directories exist
  await fs.ensureDir(config.settings.reportDir);
  await fs.ensureDir(config.settings.screenshotDir);
  await fs.ensureDir(config.settings.logDir);

  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const screenshotDir = path.join(config.settings.screenshotDir, timestamp);
  await fs.ensureDir(screenshotDir);

  // Launch browser
  console.log(chalk.blue('\n🔧 Launching browser (headless:', headless, ')...'));
  const browser = await chromium.launch({ 
    headless,
    devtools: !headless
  });

  const allResults = [];

  try {
    // Determine which apps to run
    const appsToRun = appToRun === 'all' 
      ? Object.keys(config.apps)
      : [appToRun];

    for (const appKey of appsToRun) {
      const appConfig = config.apps[appKey];
      if (!appConfig) {
        console.log(chalk.red(`Unknown app: ${appKey}`));
        continue;
      }

      const runner = new FlowRunner(appConfig, appKey);
      const results = await runner.run(browser, screenshotDir);
      allResults.push({ app: appKey, results });
    }
  } finally {
    await browser.close();
  }

  const endTime = Date.now();

  // Generate and save reports
  for (const { app, results } of allResults) {
    const report = ReportGenerator.generate(results, app, startTime, endTime);
    
    const reportFile = path.join(config.settings.reportDir, `${app}_report_${timestamp}.json`);
    await fs.writeJson(reportFile, report, { spaces: 2 });
    
    const latestFile = path.join(config.settings.reportDir, `${app}_latest.json`);
    await fs.writeJson(latestFile, report, { spaces: 2 });

    console.log(chalk.green(`\n📄 Report saved: ${reportFile}`));

    // Print summary
    printSummary(report);
  }

  console.log(chalk.bold.green('\n✅ Monitoring run completed!'));
  
  // Exit with appropriate code
  const hasFailures = allResults.some(({ results }) => 
    results.some(r => r.status === 'FAIL')
  );
  
  process.exit(hasFailures ? 1 : 0);
}

function printSummary(report) {
  console.log(chalk.bold('\n📊 Summary:'));
  console.log(`   Overall Status: ${report.overall_status === 'PASS' ? chalk.green('PASS') : report.overall_status === 'FAIL' ? chalk.red('FAIL') : chalk.yellow('PARTIAL')}`);
  console.log(`   Flows: ${report.summary.passed_flows}/${report.summary.total_flows} passed`);
  console.log(`   Steps: ${report.summary.passed_steps}/${report.summary.total_steps} passed`);
  console.log(`   Total Time: ${(report.performance.total_time_ms / 1000).toFixed(2)}s`);
  
  if (report.aggregated_issues.console_errors.length > 0) {
    console.log(chalk.yellow(`   ⚠️  Console Errors: ${report.aggregated_issues.console_errors.length}`));
  }
  if (report.aggregated_issues.network_failures.length > 0) {
    console.log(chalk.red(`   🚨 Network Failures: ${report.aggregated_issues.network_failures.length}`));
  }

  if (report.recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Recommendations:'));
    report.recommendations.forEach(rec => {
      const color = rec.severity === 'critical' ? chalk.red : rec.severity === 'high' ? chalk.yellow : chalk.blue;
      console.log(color(`   [${rec.severity.toUpperCase()}] ${rec.message}`));
      console.log(`   → ${rec.action}`);
    });
  }
}

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
