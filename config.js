/**
 * AI Monitoring Agent Configuration
 * Supports multiple applications with different user flows
 */

const config = {
  // Application configurations
  apps: {
    ielts: {
      name: 'IELTS Fast',
      url: 'https://ielts.fast',
      baseURL: 'https://ielts.fast',
      // Self-check: verify the page doesn't show ProMedic
      selfCheck: {
        mustContain: ['IELTS'],
        mustNotContain: ['ProMedic', 'Healthcare Applications']
      },
      // User flows to simulate
      flows: [
        {
          name: 'vocabulary_exploration',
          description: 'Navigate to vocabulary section and explore',
          steps: [
            { action: 'navigate', path: '/', name: 'homepage_load' },
            { action: 'wait', selector: 'nav, header, #root', timeout: 10000, name: 'app_loaded' },
            { action: 'click', selector: 'text=Vocabulary, a[href*="vocabulary"], button:has-text("Vocabulary")', name: 'navigate_to_vocab', fallback: 'a:has-text("Vocab")' },
            { action: 'wait', delay: 2000, name: 'vocab_page_load' },
            { action: 'screenshot', name: 'vocabulary_page' },
            { action: 'scroll', distance: 500, name: 'scroll_vocab_content' },
            { action: 'screenshot', name: 'vocabulary_scrolled' }
          ]
        },
        {
          name: 'reading_section_check',
          description: 'Check reading section functionality',
          steps: [
            { action: 'navigate', path: '/reading', name: 'navigate_reading' },
            { action: 'wait', selector: 'article, .reading-content, .passage', timeout: 10000, name: 'reading_loaded' },
            { action: 'screenshot', name: 'reading_page' },
            { action: 'click', selector: 'button, .question', name: 'interact_with_content', optional: true },
            { action: 'screenshot', name: 'reading_interacted' }
          ]
        },
        {
          name: 'speaking_practice_check',
          description: 'Verify speaking section loads',
          steps: [
            { action: 'navigate', path: '/speaking', name: 'navigate_speaking' },
            { action: 'wait', delay: 3000, name: 'speaking_loaded' },
            { action: 'screenshot', name: 'speaking_page' },
            { action: 'check-element', selector: 'button:has-text("Record"), .record-btn, audio, .microphone', name: 'recording_feature_present' }
          ]
        },
        {
          name: 'writing_section_check',
          description: 'Check writing section',
          steps: [
            { action: 'navigate', path: '/writing', name: 'navigate_writing' },
            { action: 'wait', delay: 3000, name: 'writing_loaded' },
            { action: 'screenshot', name: 'writing_page' },
            { action: 'fill', selector: 'textarea, [contenteditable], .editor', value: 'Test sample writing for monitoring.', name: 'test_writing_input' },
            { action: 'screenshot', name: 'writing_with_text' }
          ]
        },
        {
          name: 'listening_section_check',
          description: 'Check listening section',
          steps: [
            { action: 'navigate', path: '/listening', name: 'navigate_listening' },
            { action: 'wait', delay: 3000, name: 'listening_loaded' },
            { action: 'screenshot', name: 'listening_page' },
            { action: 'check-element', selector: 'audio, video, .audio-player, button:has-text("Play")', name: 'audio_player_present' }
          ]
        }
      ]
    },
    
    promedic: {
      name: 'ProMedic1',
      url: 'https://promedic1.com',
      baseURL: 'https://promedic1.com',
      // Self-check: verify the page doesn't show IELTS content
      selfCheck: {
        mustContain: ['ProMedic', 'Healthcare'],
        mustNotContain: ['IELTS Preparation', 'IELTS Practice']
      },
      flows: [
        {
          name: 'homepage_and_apps_check',
          description: 'Verify homepage loads and app links work',
          steps: [
            { action: 'navigate', path: '/', name: 'homepage_load' },
            { action: 'wait', selector: 'h1, header, .container', timeout: 10000, name: 'page_loaded' },
            { action: 'assert-text', selector: 'h1, title', expected: ['ProMedic', 'Healthcare'], name: 'verify_branding' },
            { action: 'screenshot', name: 'homepage' },
            { action: 'check-element', selector: 'a[href*="clinical"], a:has-text("Clinical")', name: 'clinical_link_present' },
            { action: 'check-element', selector: 'a[href*="diet"], a:has-text("Diet")', name: 'diet_link_present' },
            { action: 'check-element', selector: 'a[href*="coach"], a:has-text("Coach")', name: 'coach_link_present' }
          ]
        },
        {
          name: 'clinical_app_check',
          description: 'Verify clinical app is accessible',
          steps: [
            { action: 'navigate', path: 'https://clinical.promedic1.com', name: 'navigate_clinical' },
            { action: 'wait', delay: 5000, name: 'clinical_loaded' },
            { action: 'screenshot', name: 'clinical_page' },
            { action: 'assert-text', selector: 'body', expected: ['Clinical', 'Drug', 'Medical'], name: 'verify_clinical_content' }
          ]
        },
        {
          name: 'diet_app_check',
          description: 'Verify diet app is accessible',
          steps: [
            { action: 'navigate', path: 'https://diet.promedic1.com', name: 'navigate_diet' },
            { action: 'wait', delay: 5000, name: 'diet_loaded' },
            { action: 'screenshot', name: 'diet_page' },
            { action: 'assert-text', selector: 'body', expected: ['Diet', 'غذائي', 'Nutrition'], name: 'verify_diet_content' }
          ]
        },
        {
          name: 'coach_app_check',
          description: 'Verify coach app is accessible',
          steps: [
            { action: 'navigate', path: 'https://coach.promedic1.com', name: 'navigate_coach' },
            { action: 'wait', delay: 5000, name: 'coach_loaded' },
            { action: 'screenshot', name: 'coach_page' },
            { action: 'assert-text', selector: 'body', expected: ['Workout', 'Fitness', 'Coach', 'Exercise'], name: 'verify_coach_content' }
          ]
        },
        {
          name: 'cross_domain_integrity',
          description: 'Ensure ielts.fast is separate from promedic1.com',
          steps: [
            { action: 'navigate', path: 'https://ielts.fast', name: 'check_ielts_domain' },
            { action: 'wait', delay: 3000, name: 'ielts_loaded' },
            { action: 'assert-text', selector: 'title, h1', expected: ['IELTS'], name: 'verify_ielts_title' },
            { action: 'screenshot', name: 'ielts_verification' },
            { action: 'navigate', path: 'https://promedic1.com', name: 'return_to_promedic' },
            { action: 'wait', delay: 3000, name: 'promedic_loaded' },
            { action: 'assert-text', selector: 'title, h1', expected: ['ProMedic', 'Healthcare'], name: 'verify_promedic_title' }
          ]
        }
      ]
    }
  },

  // Global monitoring settings
  settings: {
    // Retry configuration
    retries: 3,
    retryDelay: 5000,
    exponentialBackoff: true,
    
    // Performance thresholds
    slowRequestThreshold: 3000,
    pageLoadTimeout: 30000,
    elementTimeout: 10000,
    
    // Screenshot settings
    screenshots: {
      enabled: true,
      fullPage: true,
      format: 'png'
    },
    
    // Console capture
    captureConsole: true,
    consoleLevels: ['error', 'warning', 'log'],
    
    // Network capture
    captureNetwork: true,
    
    // Self-healing actions
    selfHealing: {
      enabled: true,
      clearCookiesOnAuthFail: true,
      waitForJSDelay: 5000,
      serverErrorRetryDelay: 30000
    },
    
    // Reporting
    reportDir: './reports',
    screenshotDir: './screenshots',
    logDir: './logs',
    keepScreenshotsDays: 7,
    
    // Notifications
    notifications: {
      enabled: false,
      email: {
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        },
        from: 'monitoring@promedic1.com',
        to: process.env.ALERT_EMAIL || 'admin@promedic1.com'
      }
    }
  }
};

module.exports = config;
