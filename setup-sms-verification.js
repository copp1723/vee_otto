#!/usr/bin/env node

// Setup script for initial VAuto phone verification
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

async function setupSMSVerification() {
  console.log('🔧 Setting up SMS verification for VAuto phone setup...\n');
  
  // Check if required env vars are set
  const requiredVars = ['TWILIO_AUTH_TOKEN'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(v => console.log(`   - ${v}`));
    console.log('\nAdd these to your .env file first!');
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  console.log(`📡 Webhook server should be running on: ${baseUrl}`);
  console.log(`🎯 Webhook endpoint: ${baseUrl}/webhooks/twilio/sms`);
  console.log(`📱 Code retrieval: ${baseUrl}/api/2fa/latest\n`);
  
  // Test webhook health
  try {
    const healthResponse = await axios.post(`${baseUrl}/webhooks/twilio/health`);
    console.log('✅ Webhook server is running and healthy');
  } catch (error) {
    console.log('❌ Webhook server not responding. Start it with: npm start');
    console.log('   Or: node src/server.ts\n');
    process.exit(1);
  }
  
  console.log('\n🚀 Ready for VAuto phone verification!');
  console.log('\nSteps:');
  console.log('1. Enter your phone number in VAuto');
  console.log('2. VAuto will send SMS verification code');
  console.log('3. Run: node get-verification-code.js');
  console.log('4. Copy the code and paste it into VAuto\n');
  
  // Create a helper script to get the code
  await createCodeRetrieverScript();
}

async function createCodeRetrieverScript() {
  const script = `#!/usr/bin/env node

// Helper to get the latest SMS verification code
const axios = require('axios');

const baseUrl = '${baseUrl}';

async function getLatestCode() {
  console.log('📱 Checking for SMS verification code...\\n');
  
  try {
    const response = await axios.get(\`\${baseUrl}/api/2fa/latest\`);
    
    if (response.data && response.data.code) {
      console.log('✅ SMS Code Received!');
      console.log(\`📋 Code: \${response.data.code}\`);
      console.log(\`⏰ Received: \${response.data.timestamp}\`);
      console.log('\\n📋 Copy this code and paste it into VAuto verification field');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⏳ No SMS code received yet...');
      console.log('💡 Make sure you\\'ve requested the code in VAuto first');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Run with optional polling
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
  console.log('👀 Watching for SMS codes (press Ctrl+C to stop)...\\n');
  
  const poll = () => {
    getLatestCode().then(() => {
      setTimeout(poll, 3000); // Check every 3 seconds
    });
  };
  
  poll();
} else {
  getLatestCode();
}
`;

  require('fs').writeFileSync('get-verification-code.js', script);
  require('fs').chmodSync('get-verification-code.js', '755');
  console.log('✅ Created helper script: get-verification-code.js');
}

setupSMSVerification().catch(console.error);