import { VAutoAgentWithDashboard } from '../platforms/vauto/VAutoAgentWithDashboard';
import express from 'express';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('VisualBrowserRunner');

// Create a simple web interface to view VNC
const app = express();
const PORT = process.env.VNC_WEB_PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>vAuto Visual Browser</title>
      <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; }
        .info { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        iframe { width: 100%; height: 800px; border: 1px solid #ccc; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>vAuto Automation - Visual Browser</h1>
        <div class="info">
          <p><strong>VNC Browser View:</strong> The browser automation is running in a virtual display.</p>
          <p>Access the browser view at: <a href="http://${req.get('host')}:6080/vnc.html?autoconnect=true" target="_blank">Open VNC Viewer</a></p>
          <p>VNC Password: <code>veeotto</code></p>
        </div>
        <iframe src="http://${req.get('host')}:6080/vnc.html?autoconnect=true" frameborder="0"></iframe>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  logger.info(`Visual browser interface available at http://localhost:${PORT}`);
});

// Run the automation with visual browser
async function runVisualAutomation() {
  try {
    logger.info('Starting visual browser automation...');
    
    // Wait a bit for VNC to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Configuration for vAuto agent
    const config = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      headless: false,
      slowMo: parseInt(process.env.SLOW_MO || '1000'),
      screenshotOnError: process.env.SCREENSHOT_ON_FAILURE === 'true',
      maxVehiclesToProcess: parseInt(process.env.MAX_VEHICLES_TO_PROCESS || '1'),
      readOnlyMode: process.env.READ_ONLY_MODE === 'true',
      mailgunConfig: process.env.MAILGUN_API_KEY ? {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN || 'veeotto.ai',
        from: 'VeeOtto <automation@veeotto.ai>',
        to: ['notifications@veeotto.ai']
      } : undefined
    };
    
    // Run the vAuto agent
    const agent = new VAutoAgentWithDashboard(config);
    await agent.initialize();
    await agent.login();
    await agent.processInventory();
    
    logger.info('Visual automation completed successfully');
    
  } catch (error) {
    logger.error('Visual automation failed:', error);
    process.exit(1);
  }
}

// Start automation after services are ready
setTimeout(() => {
  runVisualAutomation();
}, 10000); // Wait 10 seconds for all services to start