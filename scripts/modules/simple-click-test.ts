#!/usr/bin/env node

import { chromium } from 'playwright';

async function main() {
  console.log('🎯 SIMPLE VEHICLE CLICK TEST');
  console.log('============================');
  console.log('This assumes you already have the inventory page open with vehicles showing.');
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 2000  // Extra slow so we can see what's happening
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to inventory (assumes already logged in)
  console.log('Going to inventory page...');
  await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
  await page.waitForTimeout(5000);
  
  // Find first row
  console.log('\nLooking for vehicle rows...');
  const rows = await page.$$('tr.x-grid3-row');
  console.log(`Found ${rows.length} rows`);
  
  if (rows.length === 0) {
    console.log('❌ No rows found!');
    return;
  }
  
  // Analyze first row
  console.log('\nAnalyzing first row...');
  const firstRow = rows[0];
  
  // Get ALL elements in the row
  const allElements = await firstRow.$$('*');
  console.log(`First row contains ${allElements.length} elements`);
  
  // Find clickable stuff
  console.log('\nLooking for clickable elements...');
  
  // Method 1: Find all anchors
  const anchors = await firstRow.$$('a');
  console.log(`\nFound ${anchors.length} <a> tags:`);
  
  for (let i = 0; i < anchors.length; i++) {
    const text = await anchors[i].textContent();
    const href = await anchors[i].getAttribute('href');
    const onclick = await anchors[i].getAttribute('onclick');
    console.log(`  Anchor ${i}: "${text}" | href=${href} | onclick=${onclick}`);
    
    // If it has year pattern (like "2016 Dodge..."), highlight and click it
    if (text && text.match(/^\d{4}\s+/)) {
      console.log(`  ✅ THIS IS THE VEHICLE LINK!`);
      
      // Make it REALLY visible
      await page.evaluate(el => {
        el.style.border = '5px solid red';
        el.style.backgroundColor = 'yellow';
        el.style.fontSize = '20px';
      }, anchors[i]);
      
      console.log('  🎯 Clicking in 3 seconds...');
      await page.waitForTimeout(3000);
      
      await anchors[i].click();
      console.log('  ✅ CLICKED!');
      
      await page.waitForTimeout(5000);
      console.log(`  📍 New URL: ${page.url()}`);
      
      console.log('\n✅ SUCCESS! Check the browser.');
      return;
    }
  }
  
  // Method 2: Try any element with onclick
  console.log('\nNo year pattern found in anchors. Looking for onclick elements...');
  const onclickElements = await firstRow.$$('[onclick]');
  console.log(`Found ${onclickElements.length} elements with onclick`);
  
  for (let i = 0; i < onclickElements.length; i++) {
    const tag = await onclickElements[i].evaluate(el => el.tagName);
    const text = await onclickElements[i].textContent();
    const onclick = await onclickElements[i].getAttribute('onclick');
    console.log(`  ${tag} with onclick: "${text}" | ${onclick}`);
  }
  
  console.log('\n❌ Could not find a clear vehicle link to click');
  console.log('Browser staying open for manual inspection...');
  
  // Keep open
  await new Promise(() => {});
}

main().catch(console.error); 