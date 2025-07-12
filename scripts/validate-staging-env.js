#!/usr/bin/env node

/**
 * Staging Environment Validation Script
 * Validates environment variables are properly configured for staging deployment
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found', colors.red);
    return null;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

function validateRequired(env) {
  log('\n🔍 Validating Required Variables:', colors.bold);
  
  const required = [
    'PLATFORM_URL',
    'PLATFORM_USERNAME', 
    'PLATFORM_PASSWORD',
    'JWT_SECRET',
    'ADMIN_USER',
    'ADMIN_PASS'
  ];
  
  let passed = 0;
  let failed = 0;
  
  required.forEach(key => {
    if (env[key] && env[key] !== '') {
      log(`  ✅ ${key}`, colors.green);
      passed++;
    } else {
      log(`  ❌ ${key} - Missing or empty`, colors.red);
      failed++;
    }
  });
  
  return { passed, failed };
}

function validateSecurity(env) {
  log('\n🔒 Security Validation:', colors.bold);
  
  const issues = [];
  const warnings = [];
  
  // Check for weak/placeholder passwords
  if (env.ADMIN_PASS === 'password123') {
    issues.push('ADMIN_PASS uses weak default password');
  }
  
  if (env.JWT_SECRET === 'your-secure-jwt-secret-change-in-production') {
    issues.push('JWT_SECRET uses placeholder value');
  }
  
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters');
  }
  
  // Check for placeholder values
  const placeholderPatterns = [
    'your_',
    'your-',
    'example',
    'placeholder',
    'change-in-production'
  ];
  
  Object.entries(env).forEach(([key, value]) => {
    if (typeof value === 'string') {
      placeholderPatterns.forEach(pattern => {
        if (value.toLowerCase().includes(pattern)) {
          warnings.push(`${key} appears to contain placeholder value: ${value}`);
        }
      });
    }
  });
  
  // Report results
  if (issues.length === 0 && warnings.length === 0) {
    log('  ✅ No security issues found', colors.green);
  } else {
    issues.forEach(issue => log(`  ❌ ${issue}`, colors.red));
    warnings.forEach(warning => log(`  ⚠️  ${warning}`, colors.yellow));
  }
  
  return { issues: issues.length, warnings: warnings.length };
}

function validateStaging(env) {
  log('\n🚀 Staging Environment Validation:', colors.bold);
  
  const stagingChecks = [
    {
      key: 'NODE_ENV',
      expected: ['staging', 'production'],
      message: 'Should be staging or production'
    },
    {
      key: 'HEADLESS',
      expected: ['true'],
      message: 'Should be true for server deployment'
    },
    {
      key: 'LOG_LEVEL',
      expected: ['warn', 'error'],
      message: 'Should be warn or error for staging'
    },
    {
      key: 'DASHBOARD_INTEGRATION',
      expected: ['true'],
      message: 'Should be true if using dashboard'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  stagingChecks.forEach(check => {
    const value = env[check.key];
    if (value && check.expected.includes(value)) {
      log(`  ✅ ${check.key}: ${value}`, colors.green);
      passed++;
    } else {
      log(`  ⚠️  ${check.key}: ${value || 'not set'} - ${check.message}`, colors.yellow);
      failed++;
    }
  });
  
  return { passed, failed };
}

function validateUrls(env) {
  log('\n🌐 URL Configuration Validation:', colors.bold);
  
  const urlKeys = [
    'FRONTEND_URL',
    'REACT_APP_API_URL',
    'REACT_APP_WS_URL',
    'DASHBOARD_URL',
    'PUBLIC_URL',
    'WEBHOOK_URL'
  ];
  
  let passed = 0;
  let warnings = 0;
  
  urlKeys.forEach(key => {
    const value = env[key];
    if (value) {
      if (value.includes('localhost') || value.includes('127.0.0.1')) {
        log(`  ⚠️  ${key}: ${value} - Uses localhost (not suitable for staging)`, colors.yellow);
        warnings++;
      } else if (value.startsWith('http://') || value.startsWith('https://')) {
        log(`  ✅ ${key}: ${value}`, colors.green);
        passed++;
      } else {
        log(`  ⚠️  ${key}: ${value} - Invalid URL format`, colors.yellow);
        warnings++;
      }
    } else {
      log(`  ❌ ${key}: Not set`, colors.red);
      warnings++;
    }
  });
  
  return { passed, warnings };
}

function validateIntegrations(env) {
  log('\n🔧 Integration Services Validation:', colors.bold);
  
  const integrations = [
    {
      name: 'Twilio SMS',
      keys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
      optional: false
    },
    {
      name: 'Mailgun Email',
      keys: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN'],
      optional: false
    },
    {
      name: 'OpenRouter AI',
      keys: ['OPENROUTER_API_KEY'],
      optional: true
    },
    {
      name: 'SMTP Email',
      keys: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
      optional: true
    }
  ];
  
  integrations.forEach(integration => {
    const configured = integration.keys.every(key => env[key] && env[key] !== '');
    const hasPlaceholders = integration.keys.some(key => 
      env[key] && (env[key].includes('your_') || env[key].includes('your-'))
    );
    
    if (configured && !hasPlaceholders) {
      log(`  ✅ ${integration.name}: Configured`, colors.green);
    } else if (configured && hasPlaceholders) {
      log(`  ⚠️  ${integration.name}: Has placeholder values`, colors.yellow);
    } else if (!integration.optional) {
      log(`  ❌ ${integration.name}: Required but not configured`, colors.red);
    } else {
      log(`  ⚠️  ${integration.name}: Optional - not configured`, colors.yellow);
    }
  });
}

function generateSummary(results) {
  log('\n📊 VALIDATION SUMMARY:', colors.bold);
  log('═'.repeat(50), colors.blue);
  
  const totalIssues = results.security.issues + results.required.failed;
  const totalWarnings = results.security.warnings + results.staging.failed + results.urls.warnings;
  
  if (totalIssues === 0 && totalWarnings === 0) {
    log('🎉 Environment configuration is ready for staging deployment!', colors.green);
  } else if (totalIssues === 0) {
    log('⚠️  Environment has warnings but no critical issues', colors.yellow);
    log(`   Total warnings: ${totalWarnings}`, colors.yellow);
  } else {
    log('❌ Environment has critical issues that must be fixed', colors.red);
    log(`   Critical issues: ${totalIssues}`, colors.red);
    log(`   Warnings: ${totalWarnings}`, colors.yellow);
  }
  
  log('\n📋 Next Steps:', colors.bold);
  if (totalIssues > 0) {
    log('1. Fix all critical issues marked with ❌', colors.red);
    log('2. Review and address warnings marked with ⚠️', colors.yellow);
    log('3. Re-run this validation script', colors.blue);
  } else {
    log('1. Review warnings and address as needed', colors.yellow);
    log('2. Test integrations (SMS, email, etc.)', colors.blue);
    log('3. Deploy to staging environment', colors.green);
  }
  
  log('\n🔗 Resources:', colors.bold);
  log('- Review: STAGING_DEPLOYMENT_CHECKLIST.md', colors.blue);
  log('- Template: .env.staging', colors.blue);
  log('- Documentation: docs/DEPLOYMENT_GUIDE.md', colors.blue);
}

function main() {
  log('🔍 Vee Otto Staging Environment Validator', colors.bold);
  log('═'.repeat(50), colors.blue);
  
  const env = loadEnvFile();
  if (!env) {
    process.exit(1);
  }
  
  const results = {
    required: validateRequired(env),
    security: validateSecurity(env),
    staging: validateStaging(env),
    urls: validateUrls(env)
  };
  
  validateIntegrations(env);
  generateSummary(results);
  
  const totalIssues = results.security.issues + results.required.failed;
  process.exit(totalIssues > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { main, loadEnvFile, validateRequired, validateSecurity };