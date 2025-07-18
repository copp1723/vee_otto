#!/usr/bin/env node

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/help', (req, res) => {
  res.send(`
    <h1>VAuto Browser Helper</h1>
    <p>Run this in your browser console:</p>
    <pre>
// Navigate to Vehicle Info and click Factory Equipment
fetch('http://localhost:3333/factory-equipment-script')
  .then(r => r.text())
  .then(script => eval(script));
    </pre>
  `);
});

app.get('/factory-equipment-script', (req, res) => {
  const script = `
    console.log('🚀 Starting Factory Equipment navigation...');
    
    // Check if on Vehicle Info tab
    const factoryBtn = document.querySelector('#ext-gen199');
    if (factoryBtn?.offsetParent !== null) {
      console.log('✅ Already on Vehicle Info tab');
      factoryBtn.click();
      console.log('✅ Clicked Factory Equipment');
    } else {
      console.log('📑 Need to navigate to Vehicle Info tab first...');
      
      // Find and click Vehicle Info
      const elements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent?.trim() === 'Vehicle Info' && !el.children.length
      );
      
      if (elements.length > 0) {
        let clicked = false;
        for (const elem of elements) {
          let target = elem;
          for (let i = 0; i < 5; i++) {
            if (target) {
              try {
                target.click();
                console.log('✅ Clicked Vehicle Info tab');
                clicked = true;
                break;
              } catch (e) {
                target = target.parentElement;
              }
            }
          }
          if (clicked) break;
        }
        
        // Click Factory Equipment after delay
        setTimeout(() => {
          const factory = document.querySelector('#ext-gen199');
          if (factory) {
            factory.click();
            console.log('✅ Clicked Factory Equipment');
          } else {
            console.log('❌ Factory Equipment button not found');
          }
        }, 2000);
      } else {
        console.log('❌ Could not find Vehicle Info tab');
      }
    }
  `;
  
  res.type('text/javascript').send(script);
});

const PORT = 3333;
app.listen(PORT, () => {
  console.log(`\n🚀 Browser Helper Server Running!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\nOpen http://localhost:${PORT}/help for instructions`);
  console.log(`\nOr run this in your browser console:`);
  console.log(`\nfetch('http://localhost:${PORT}/factory-equipment-script').then(r => r.text()).then(script => eval(script));`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});