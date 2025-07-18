#!/usr/bin/env node

import { chromium } from 'playwright';

async function testFactoryEquipmentDirect() {
  console.log('🚀 Testing Factory Equipment Navigation...\n');

  try {
    // Since we can't connect to the existing browser without the WebSocket endpoint,
    // let's provide instructions for manual testing
    console.log('📋 Manual Test Instructions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nIn your browser with the modal open, open the Developer Console (F12) and run:\n');
    
    console.log(`// Step 1: Check current tab
const factoryButton = document.querySelector('#ext-gen199');
if (factoryButton && factoryButton.offsetParent !== null) {
  console.log('✅ Already on Vehicle Info tab');
} else {
  console.log('📑 Not on Vehicle Info tab');
  
  // Step 2: Click Vehicle Info tab
  const tabs = Array.from(document.querySelectorAll('*')).filter(el => 
    el.textContent?.trim() === 'Vehicle Info' && !el.children.length
  );
  
  if (tabs.length > 0) {
    // Click on the text element or its parent
    let clicked = false;
    for (const tab of tabs) {
      let current = tab;
      for (let i = 0; i < 5; i++) {
        try {
          current.click();
          console.log('✅ Clicked Vehicle Info tab');
          clicked = true;
          break;
        } catch (e) {
          current = current.parentElement;
          if (!current) break;
        }
      }
      if (clicked) break;
    }
  }
}

// Step 3: Wait a moment then click Factory Equipment
setTimeout(() => {
  const factory = document.querySelector('#ext-gen199');
  if (factory) {
    factory.click();
    console.log('✅ Clicked Factory Equipment button');
  } else {
    console.log('❌ Factory Equipment button not found');
  }
}, 2000);`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nThis script will:');
    console.log('1. Check if you\'re on the Vehicle Info tab');
    console.log('2. Navigate to Vehicle Info if needed');
    console.log('3. Click the Factory Equipment button\n');
    
    console.log('Copy and paste the entire code block above into your browser console.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testFactoryEquipmentDirect();