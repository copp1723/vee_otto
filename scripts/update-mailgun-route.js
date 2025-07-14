const readline = require('readline');
const crypto = require('crypto');

// Use node-fetch if fetch not available
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function updateMailgunRoute() {
  console.log('🔧 Mailgun Route Configuration Tool\n');
  
  // Load environment variables
  require('dotenv').config();
  
  // Check environment variables
  const requiredVars = ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'TWO_FACTOR_EMAIL'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing.join(', '));
    console.log('\nPlease add these to your .env file:');
    missing.forEach(v => console.log(`${v}=your-value-here`));
    rl.close();
    return;
  }
  
  // Ask for webhook URL
  console.log('Current options for webhook URL:');
  console.log('1. Local server with ngrok (e.g., https://abc123.ngrok.io)');
  console.log('2. Render deployment (e.g., https://your-app.onrender.com)');
  console.log('3. Custom URL\n');
  
  rl.question('Enter your webhook base URL (without path): ', async (baseUrl) => {
    if (!baseUrl) {
      console.log('❌ No URL provided');
      rl.close();
      return;
    }
    
    // Ensure URL doesn't end with slash
    baseUrl = baseUrl.replace(/\/$/, '');
    const webhookUrl = `${baseUrl}/webhooks/mailgun/2fa`;
    
    console.log(`\n📍 Webhook URL will be: ${webhookUrl}`);
    
    rl.question('\nProceed with update? (y/n): ', async (confirm) => {
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Update cancelled');
        rl.close();
        return;
      }
      
      try {
        const apiKey = process.env.MAILGUN_API_KEY;
        const domain = process.env.MAILGUN_DOMAIN;
        const recipient = process.env.TWO_FACTOR_EMAIL;
        
        const auth = 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');
        const apiBase = 'https://api.mailgun.net/v3';
        
        // Expression for route
        const expression = `match_recipient("${recipient}") and match_header("from", ".*coxautoinc.*|.*vauto.*")`;
        
        // Actions
        const actions = [`forward("${webhookUrl}")`, 'store()'];
        
        console.log('\n1. Checking existing routes...');
        const routesResponse = await fetch(`${apiBase}/routes?limit=100`, {
          headers: { Authorization: auth }
        });
        
        if (!routesResponse.ok) {
          throw new Error(`Failed to fetch routes: ${routesResponse.statusText}`);
        }
        
        const { items } = await routesResponse.json();
        let existingRoute = items.find(r => r.expression === expression);
        
        let updatedRoute;
        if (existingRoute) {
          console.log('✅ Found existing route, updating...');
          const updateResponse = await fetch(`${apiBase}/routes/${existingRoute.id}`, {
            method: 'PUT',
            headers: { Authorization: auth },
            body: new URLSearchParams({
              expression,
              action: actions
            })
          });
          
          if (!updateResponse.ok) {
            throw new Error(`Failed to update route: ${updateResponse.statusText}`);
          }
          
          updatedRoute = await updateResponse.json();
        } else {
          console.log('Creating new route...');
          const createResponse = await fetch(`${apiBase}/routes`, {
            method: 'POST',
            headers: { Authorization: auth },
            body: new URLSearchParams({
              priority: '0',
              description: 'VAuto 2FA Webhook',
              expression,
              action: actions
            })
          });
          
          if (!createResponse.ok) {
            throw new Error(`Failed to create route: ${createResponse.statusText}`);
          }
          
          updatedRoute = await createResponse.json();
        }
        
        console.log('✅ Route updated successfully!');
        console.log('   Expression:', expression);
        console.log('   Actions:', actions);
        
        // Test the webhook
        console.log('\n2. Testing webhook endpoint...');
        try {
          const testBody = {
            timestamp: Math.floor(Date.now() / 1000).toString(),
            token: crypto.randomBytes(16).toString('hex'),
            'body-plain': 'Test email with code: 123456'
          };
          testBody.signature = crypto.createHmac('sha256', apiKey)
            .update(testBody.timestamp + testBody.token)
            .digest('hex');
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(testBody)
          });
          
          if (response.ok) {
            console.log('✅ Webhook endpoint is responding:', await response.text());
          } else {
            console.log('⚠️  Webhook endpoint returned:', response.status, response.statusText);
            console.log('   Make sure your server is running on the correct port');
          }
        } catch (testError) {
          console.log('⚠️  Could not reach webhook endpoint');
          console.log('   Make sure your server is running and accessible at:', baseUrl);
        }
        
        console.log('\n🎉 Mailgun route configuration complete!');
        console.log('\nNext steps:');
        console.log('1. Ensure your server is running: npm run server:dev');
        console.log('2. Keep ngrok running if using local development');
        console.log('3. Test in vAuto by triggering email verification');
        console.log('4. Check codes with: curl http://localhost:10000/api/2fa/latest');
        
      } catch (error) {
        console.error('\n❌ Error updating route:', error.message);
        console.log('\nTroubleshooting:');
        console.log('- Verify your Mailgun API key in .env');
        console.log('- Check your Mailgun domain');
        console.log('- Ensure the recipient email is correct');
      }
      
      rl.close();
    });
  });
}

updateMailgunRoute(); 