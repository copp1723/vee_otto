#!/usr/bin/env node

// Quick debug script to see what's in the vehicle rows

import { chromium } from 'playwright';

async function debugVehicleLinks() {
  console.log('🔍 DEBUG: Vehicle Link Inspector');
  console.log('================================\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Navigate to inventory page...');
  await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
  await page.waitForTimeout(5000);
  
  // Find all vehicle rows
  const rows = await page.$$('tr.x-grid3-row');
  console.log(`\nFound ${rows.length} vehicle rows\n`);
  
  if (rows.length > 0) {
    console.log('Analyzing first 3 rows...\n');
    
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`=== ROW ${i + 1} ===`);
      
      const row = rows[i];
      
      // Get all cells
      const cells = await row.$$('td');
      console.log(`Found ${cells.length} cells`);
      
      // Check each cell for links
      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j];
        const cellText = await cell.textContent();
        
        // Look for links in this cell
        const links = await cell.$$('a');
        const divs = await cell.$$('div');
        
        if (links.length > 0 || (cellText && cellText.trim().length > 0)) {
          console.log(`\nCell ${j + 1}:`);
          console.log(`  Text: "${cellText?.trim()}"`);
          console.log(`  Links: ${links.length}`);
          console.log(`  Divs: ${divs.length}`);
          
          // If there are links, analyze them
          for (let k = 0; k < links.length; k++) {
            const link = links[k];
            const linkText = await link.textContent();
            const href = await link.getAttribute('href');
            const onclick = await link.getAttribute('onclick');
            const className = await link.getAttribute('class');
            
            console.log(`  Link ${k + 1}:`);
            console.log(`    Text: "${linkText}"`);
            console.log(`    href: ${href}`);
            console.log(`    onclick: ${onclick}`);
            console.log(`    class: ${className}`);
          }
          
          // Check if div has onclick
          for (let k = 0; k < divs.length; k++) {
            const div = divs[k];
            const onclick = await div.getAttribute('onclick');
            if (onclick) {
              console.log(`  Div ${k + 1} has onclick: ${onclick}`);
            }
          }
        }
      }
      
      console.log('\n' + '-'.repeat(50) + '\n');
    }
    
    // Try the current selectors
    console.log('Testing current selectors...\n');
    
    const selectors = [
      'tr.x-grid3-row a',
      'tr.x-grid3-row td a',
      'tr.x-grid3-row div[onclick]',
      'tr.x-grid3-row span[onclick]',
      '.x-grid3-row a',
      '.x-grid3-row-table a'
    ];
    
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}": Found ${elements.length} elements`);
      
      if (elements.length > 0 && elements.length < 10) {
        // Show first few
        for (let i = 0; i < Math.min(3, elements.length); i++) {
          const text = await elements[i].textContent();
          console.log(`  [${i}]: "${text}"`);
        }
      }
    }
  }
  
  console.log('\nKeeping browser open for inspection...');
  await new Promise(() => {});
}

debugVehicleLinks().catch(console.error); 