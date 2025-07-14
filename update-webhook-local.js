const twilio = require('twilio');

async function updateTwilioWebhook() {
  console.log('🔧 Updating Twilio Webhook to Local Server...\n');
  
  // Load environment variables
  require('dotenv').config();
  
  const localUrl = 'https://10000-ix3k41mu8b22udnvh2ar8-0ca79422.manusvm.computer';
  const webhookUrl = `${localUrl}/webhooks/twilio/sms`;
  
  // Check environment variables
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    return;
  }
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // First, get the current phone number configuration
    console.log('1. Finding your Twilio phone number...');
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
    
    if (phoneNumbers.length === 0) {
      console.log('❌ Phone number not found:', process.env.TWILIO_PHONE_NUMBER);
      return;
    }
    
    const phoneNumber = phoneNumbers[0];
    console.log('✅ Found phone number:', phoneNumber.phoneNumber);
    console.log('   Current SMS URL:', phoneNumber.smsUrl);
    
    // Update the webhook URL
    console.log('2. Updating webhook URL...');
    const updatedNumber = await client.incomingPhoneNumbers(phoneNumber.sid)
      .update({
        smsUrl: webhookUrl,
        smsMethod: 'POST'
      });
    
    console.log('✅ Webhook URL updated successfully!');
    console.log('   New SMS URL:', updatedNumber.smsUrl);
    console.log('   Method:', updatedNumber.smsMethod);
    
    // Verify the update
    console.log('3. Verifying update...');
    const verifyNumber = await client.incomingPhoneNumbers(phoneNumber.sid).fetch();
    console.log('✅ Verification successful:');
    console.log('   SMS URL:', verifyNumber.smsUrl);
    console.log('   SMS Method:', verifyNumber.smsMethod);
    
    console.log('\n🎉 Twilio webhook is now configured for your local server!');
    console.log('Next steps:');
    console.log('1. Make sure your local server is running on port 10000');
    console.log('2. Test vAuto phone verification');
    console.log('3. Check for SMS codes using: node get-sms-code.js');
    
  } catch (error) {
    console.error('❌ Error updating webhook:', error.message);
  }
}

updateTwilioWebhook();

