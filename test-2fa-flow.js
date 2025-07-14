#!/usr/bin/env node

/**
 * Test script for debugging 2FA flow
 * This script helps test the entire 2FA process from SMS receipt to code entry
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { chromium } = require('playwright');

async function testWebhookEndpoint() {
  console.log('\n=== Testing Webhook Endpoint ===');
  
  const webhookUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  const testUrl = `${webhookUrl}/api/2fa/latest`;
  
  try {
    console.log(`Testing: ${testUrl}`);
    const response = await fetch(testUrl);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.code) {
      console.log(`✅ Found code: ${data.code}`);
      console.log(`Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
    } else {
      console.log('ℹ️  No code available yet');
    }
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
}

async function test2FAPageInteraction() {
  console.log('\n=== Testing 2FA Page Interaction ===');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to a test page with 2FA inputs
    console.log('Creating test page with 2FA inputs...');
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>2FA Test Page</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
            }
            input {
              display: block;
              margin: 10px 0;
              padding: 10px;
              font-size: 16px;
              width: 100%;
              box-sizing: border-box;
            }
            button {
              padding: 10px 20px;
              font-size: 16px;
              margin: 10px 0;
              cursor: pointer;
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .success {
              color: green;
              font-weight: bold;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1>2FA Test Page</h1>
          <p>This page simulates VAuto's 2FA input form</p>
          
          <!-- Test various input types that might be used -->
          <h3>Test Input 1 (id="otp")</h3>
          <input type="text" id="otp" name="otp" placeholder="Enter 6-digit code">
          
          <h3>Test Input 2 (name="verification")</h3>
          <input type="text" id="verification" name="verification" placeholder="Verification Code">
          
          <h3>Test Input 3 (type="number")</h3>
          <input type="number" placeholder="Numeric code input">
          
          <h3>Test Submit Buttons</h3>
          <button id="verify-btn" onclick="handleVerify()">Verify</button>
          <button type="submit" onclick="handleSubmit()">Submit</button>
          <button disabled id="disabled-btn">Disabled Button</button>
          
          <div id="result"></div>
          
          <script>
            function handleVerify() {
              const code = document.getElementById('otp').value;
              document.getElementById('result').innerHTML = 
                '<div class="success">Verify clicked with code: ' + code + '</div>';
            }
            
            function handleSubmit() {
              const code = document.getElementById('verification').value;
              document.getElementById('result').innerHTML = 
                '<div class="success">Submit clicked with code: ' + code + '</div>';
            }
            
            // Enable disabled button after 3 seconds
            setTimeout(() => {
              document.getElementById('disabled-btn').disabled = false;
              document.getElementById('disabled-btn').textContent = 'Now Enabled';
            }, 3000);
          </script>
        </body>
      </html>
    `);
    
    console.log('Test page created. Testing different selectors...');
    
    // Test the VAuto selectors
    const selectors = {
      otpInput: '//input[contains(@id, "otp")] | //input[contains(@name, "otp")] | //input[contains(@placeholder, "code")] | //input[@type="text"][contains(@class, "code")] | //input[@type="number"] | //input[contains(@id, "verification")] | //input[contains(@name, "verification")]',
      submitButton: '//button[contains(text(), "Verify")] | //button[contains(text(), "Submit")] | //button[contains(text(), "Continue")] | //button[@type="submit"] | //input[@type="submit"]'
    };
    
    // Test finding input
    console.log('\nTesting input selector...');
    const inputElement = await page.locator(selectors.otpInput).first();
    const inputFound = await inputElement.isVisible();
    console.log(`Input found: ${inputFound ? '✅' : '❌'}`);
    
    if (inputFound) {
      // Test entering code
      const testCode = '123456';
      console.log(`\nEntering test code: ${testCode}`);
      
      // Clear and fill
      await inputElement.clear();
      await inputElement.fill(testCode);
      
      // Verify value
      const enteredValue = await inputElement.inputValue();
      console.log(`Value entered: ${enteredValue === testCode ? '✅' : '❌'} (${enteredValue})`);
      
      // Test alternative input methods
      console.log('\nTesting alternative input methods...');
      
      // Method 1: Click and type
      await inputElement.clear();
      await inputElement.click();
      await page.keyboard.type(testCode, { delay: 50 });
      const typedValue = await inputElement.inputValue();
      console.log(`Click & type: ${typedValue === testCode ? '✅' : '❌'} (${typedValue})`);
    }
    
    // Test finding submit button
    console.log('\nTesting submit button selector...');
    const submitElements = await page.locator(selectors.submitButton).all();
    console.log(`Found ${submitElements.length} submit button(s)`);
    
    if (submitElements.length > 0) {
      for (let i = 0; i < submitElements.length; i++) {
        const isVisible = await submitElements[i].isVisible();
        const isEnabled = await submitElements[i].isEnabled();
        const text = await submitElements[i].textContent();
        console.log(`Button ${i + 1}: "${text}" - Visible: ${isVisible ? '✅' : '❌'}, Enabled: ${isEnabled ? '✅' : '❌'}`);
      }
      
      // Test clicking
      console.log('\nTesting button click...');
      await submitElements[0].click();
      
      // Check result
      const resultText = await page.locator('#result').textContent();
      console.log(`Click result: ${resultText ? '✅' : '❌'} - ${resultText}`);
    }
    
    // Test disabled button behavior
    console.log('\nTesting disabled button behavior...');
    const disabledBtn = await page.locator('#disabled-btn');
    const initiallyDisabled = await disabledBtn.isDisabled();
    console.log(`Initially disabled: ${initiallyDisabled ? '✅' : '❌'}`);
    
    console.log('Waiting for button to be enabled (3 seconds)...');
    await page.waitForTimeout(3500);
    
    const nowEnabled = await disabledBtn.isEnabled();
    console.log(`Now enabled: ${nowEnabled ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Page interaction test failed:', error);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open for inspection
    await browser.close();
  }
}

async function simulateSMSWebhook() {
  console.log('\n=== Simulating SMS Webhook ===');
  
  const webhookUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  const testWebhookUrl = `${webhookUrl}/webhooks/twilio/sms`;
  
  // Simulate Twilio SMS webhook payload
  const testPayload = {
    From: '+1234567890',
    To: process.env.TWILIO_PHONE_NUMBER || '+13137658345',
    Body: 'One-time Bridge ID code: 654321',
    MessageSid: 'TEST123456789'
  };
  
  try {
    console.log(`Sending test SMS to: ${testWebhookUrl}`);
    console.log('Payload:', testPayload);
    
    const response = await fetch(testWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(testPayload).toString()
    });
    
    console.log(`Response status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
    // Now check if the code is available
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testWebhookEndpoint();
    
  } catch (error) {
    console.error('❌ SMS simulation failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🔍 2FA Flow Debug Tool');
  console.log('='.repeat(50));
  
  // Check environment
  console.log('\n📋 Environment Check:');
  console.log(`TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER || 'NOT SET'}`);
  console.log(`TWO_FACTOR_METHOD: ${process.env.TWO_FACTOR_METHOD || 'NOT SET'}`);
  console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL || 'NOT SET (using localhost:3000)'}`);
  console.log(`Server Port: ${process.env.PORT || '3000'}`);
  
  // Run tests
  await testWebhookEndpoint();
  await simulateSMSWebhook();
  await test2FAPageInteraction();
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runAllTests().catch(console.error);