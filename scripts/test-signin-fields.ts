#!/usr/bin/env node

import { chromium } from 'playwright';

async function testSigninFields() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 
  });
  
  const page = await browser.newPage();
  console.log('🌐 Navigating to signin.coxautoinc.com...');
  
  await page.goto('https://signin.coxautoinc.com');
  await page.waitForLoadState('networkidle');
  
  console.log('📋 Looking for input fields...');
  
  // Try to find all input fields
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} input fields`);
  
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const type = await input.getAttribute('type');
    const name = await input.getAttribute('name');
    const id = await input.getAttribute('id');
    const placeholder = await input.getAttribute('placeholder');
    
    console.log(`Input ${i + 1}:`);
    console.log(`  Type: ${type}`);
    console.log(`  Name: ${name}`);
    console.log(`  ID: ${id}`);
    console.log(`  Placeholder: ${placeholder}`);
    console.log('---');
  }
  
  // Also check for any forms
  const forms = await page.locator('form').all();
  console.log(`\nFound ${forms.length} forms`);
  
  // Check for buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons`);
  
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const text = await button.textContent();
    const type = await button.getAttribute('type');
    console.log(`Button ${i + 1}: "${text?.trim()}" (type: ${type})`);
  }
  
  console.log('\n⏸️  Keeping browser open for manual inspection...');
  console.log('Press Ctrl+C to close');
  
  // Keep browser open
  await new Promise(() => {});
}

testSigninFields().catch(console.error);