import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import dotenv from 'dotenv';
import winston from 'winston';
import twilio from 'twilio';

// Import types
import {
  DashboardMetrics,
  ActionQueueItem,
  RecentCompletion,
  PerformanceData,
  SystemStatus,
  ApiResponse
} from '../core/types';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/server.log' })
  ]
});

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio form POSTs
app.use(express.static(path.join(__dirname, '../dist/dashboard')));
// Serve vAuto mockup test site statically
app.use('/test-mockup', express.static(path.join(__dirname, '../tests/fixtures/vauto-mockup')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any): void => {
    if (err) {
      res.sendStatus(403);
      return;
    }
    (req as any).user = user;
    next();
  });
};

// In-memory data store (replace with database in production)
let dashboardData = {
  metrics: {
    noPricePending: {
      current: 23,
      total: 156,
      percentageReduction: 85.3,
    },
    timeSaved: {
      hours: 12.5,
      formatted: '12h 30m',
    },
    valueProtected: {
      amount: 245830,
      formatted: '$245,830',
    },
  },
  actionQueue: [
    {
      id: 'aq-001',
      vin: '1HGBH41JXMN109186',
      year: 2021,
      make: 'Honda',
      model: 'Civic',
      issueType: 'NO_STICKER',
      issueDescription: 'Sticker price missing from window',
      estimatedTime: 5,
    },
    {
      id: 'aq-002',
      vin: '2T1BURHE0JC123456',
      year: 2018,
      make: 'Toyota',
      model: 'Corolla',
      issueType: 'LOW_CONFIDENCE',
      issueDescription: 'OCR confidence below threshold (65%)',
      estimatedTime: 8,
    },
  ] as ActionQueueItem[],
  recentCompletions: [
    {
      id: 'rc-001',
      vin: '1FTEW1E55KF123456',
      year: 2019,
      make: 'Ford',
      model: 'F-150',
      completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      timeSaved: 12,
      valueProtected: 2850,
      outcome: 'Price adjusted to market value',
    },
  ] as RecentCompletion[],
  performanceData: [
    { date: '2025-07-05', vehiclesProcessed: 45, timeSaved: 8.5, valueProtected: 32400 },
    { date: '2025-07-06', vehiclesProcessed: 52, timeSaved: 9.2, valueProtected: 38750 },
    { date: '2025-07-07', vehiclesProcessed: 38, timeSaved: 7.1, valueProtected: 28950 },
    { date: '2025-07-08', vehiclesProcessed: 61, timeSaved: 11.3, valueProtected: 45200 },
    { date: '2025-07-09', vehiclesProcessed: 48, timeSaved: 8.9, valueProtected: 35600 },
    { date: '2025-07-10', vehiclesProcessed: 55, timeSaved: 10.2, valueProtected: 41300 },
    { date: '2025-07-11', vehiclesProcessed: 42, timeSaved: 7.8, valueProtected: 31850 },
  ] as PerformanceData[],
  systemStatus: {
    operational: true,
    lastUpdate: new Date().toISOString(),
    activeAgents: 0,
  } as SystemStatus,
};

/**
 * Twilio SMS Webhook Handler
 */
interface StoredCode {
  code: string;
  timestamp: string;
  from: string;
}
let storedCodes: StoredCode[] = [];
const CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Health check endpoint for Twilio webhook
app.post('/webhooks/twilio/health', (req: Request, res: Response) => {
  res.json({
    status: "ok",
    provider: "initialized",
    timestamp: new Date().toISOString()
  });
});

// Twilio SMS webhook endpoint
app.post('/webhooks/twilio/sms', (req: Request, res: Response) => {
  const signature = req.headers['x-twilio-signature'] as string;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body;

  if (!twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN || '', signature, url, params)) {
    logger.warn('Invalid Twilio signature');
    return res.status(403).send('Invalid signature');
  }

  const { Body, From } = req.body;
  if (Body) {
    // Extract numeric code from VAuto SMS format: "One-time Bridge ID code: 279253. Code expires..."
    const codeMatch = Body.match(/\b(\d{6})\b/);
    if (codeMatch) {
      const code = codeMatch[1];
      const timestamp = new Date().toISOString();
      storedCodes.push({ code, timestamp, from: From });
      // Remove expired codes
      storedCodes = storedCodes.filter(c => new Date().getTime() - new Date(c.timestamp).getTime() < CODE_EXPIRATION_MS);
      logger.info(`Received 2FA SMS from ${From}: extracted code ${code} from message: ${Body}`);
    } else {
      logger.warn(`Received SMS from ${From} but could not extract 6-digit code from: ${Body}`);
    }
  } else {
    logger.warn('Received SMS webhook with no Body');
  }
  return res.status(200).send('<Response></Response>');
});

// Endpoint for agent to fetch latest 2FA code
app.get('/api/2fa/latest', (req: Request, res: Response) => {
  if (storedCodes.length > 0) {
    const latest = storedCodes[storedCodes.length - 1];
    if (new Date().getTime() - new Date(latest.timestamp).getTime() < CODE_EXPIRATION_MS) {
      res.json({
        code: latest.code,
        timestamp: latest.timestamp
      });
    } else {
      res.status(404).json({ error: 'Latest code expired' });
    }
  } else {
    res.status(404).json({ error: 'No 2FA code received yet' });
  }
});

// Test endpoint to manually add a 2FA code (for testing only)
app.post('/api/2fa/test', (req: Request, res: Response) => {
  const { code } = req.body;
  if (code && /^\d{6}$/.test(code)) {
    const timestamp = new Date().toISOString();
    storedCodes.push({ code, timestamp, from: 'TEST' });
    logger.info(`Test 2FA code added: ${code}`);
    res.json({ success: true, code, timestamp });
  } else {
    res.status(400).json({ error: 'Invalid code format' });
  }
});


// API Routes

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  // Simple authentication (replace with proper auth in production)
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Dashboard metrics endpoint
app.get('/api/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<DashboardMetrics> = {
      success: true,
      data: dashboardData.metrics,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Action queue endpoint
app.get('/api/action-queue', authenticateToken, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<ActionQueueItem[]> = {
      success: true,
      data: dashboardData.actionQueue,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching action queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action queue',
      timestamp: new Date().toISOString()
    });
  }
});

// Recent completions endpoint
app.get('/api/recent-completions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<RecentCompletion[]> = {
      success: true,
      data: dashboardData.recentCompletions,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching recent completions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent completions',
      timestamp: new Date().toISOString()
    });
  }
});

// Performance data endpoint
app.get('/api/performance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<PerformanceData[]> = {
      success: true,
      data: dashboardData.performanceData,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching performance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance data',
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint
app.get('/api/system-status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<SystemStatus> = {
      success: true,
      data: dashboardData.systemStatus,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  } catch (error) {
    logger.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system status',
      timestamp: new Date().toISOString()
    });
  }
});

// Start vAuto automation endpoint
app.post('/api/automation/start', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('Starting vAuto automation...');
    
    // Import and run the vAuto agent
    const { VAutoAgentWithDashboard } = await import('../platforms/vauto/VAutoAgentWithDashboard');
    
    const config = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      headless: process.env.HEADLESS === 'false' ? false : true,
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
    
    // Update system status
    dashboardData.systemStatus.activeAgents = 1;
    io.emit('STATUS_UPDATE', dashboardData.systemStatus);
    
    // Run automation in background
    const agent = new VAutoAgentWithDashboard(config);
    agent.initialize()
      .then(() => agent.login())
      .then(() => agent.processInventory())
      .then(result => {
        logger.info('Automation completed successfully', result);
        dashboardData.systemStatus.activeAgents = 0;
        io.emit('STATUS_UPDATE', dashboardData.systemStatus);
      })
      .catch(error => {
        logger.error('Automation failed', error);
        dashboardData.systemStatus.activeAgents = 0;
        io.emit('STATUS_UPDATE', dashboardData.systemStatus);
      });
    
    res.json({
      success: true,
      message: 'Automation started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error starting automation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start automation',
      timestamp: new Date().toISOString()
    });
  }
});

// Process all items endpoint
app.post('/api/process-queue', authenticateToken, async (req: Request, res: Response) => {
  try {
    logger.info('Processing all items in queue...');
    
    // Simulate processing (replace with actual Vee Otto agent integration)
    const itemsToProcess = [...dashboardData.actionQueue];
    dashboardData.actionQueue = [];
    
    // Update metrics
    dashboardData.metrics.noPricePending.current = 0;
    dashboardData.metrics.timeSaved.hours += itemsToProcess.length * 0.2;
    dashboardData.metrics.timeSaved.formatted = `${Math.floor(dashboardData.metrics.timeSaved.hours)}h ${Math.round((dashboardData.metrics.timeSaved.hours % 1) * 60)}m`;
    
    // Add to recent completions
    const newCompletions: RecentCompletion[] = itemsToProcess.map((item, index) => ({
      id: `rc-${Date.now()}-${index}`,
      vin: item.vin,
      year: item.year,
      make: item.make,
      model: item.model,
      completedAt: new Date().toISOString(),
      timeSaved: item.estimatedTime,
      valueProtected: Math.floor(Math.random() * 3000) + 500,
      outcome: 'Processed automatically'
    }));
    
    dashboardData.recentCompletions = [
      ...newCompletions,
      ...dashboardData.recentCompletions
    ].slice(0, 10); // Keep only last 10
    
    // Emit updates via WebSocket
    io.emit('QUEUE_UPDATE', dashboardData.actionQueue);
    io.emit('METRICS_UPDATE', dashboardData.metrics);
    io.emit('COMPLETION_UPDATE', dashboardData.recentCompletions);
    
    res.json({
      success: true,
      data: { processedCount: itemsToProcess.length },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process queue',
      timestamp: new Date().toISOString()
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);
  
  // Send initial data
  socket.emit('METRICS_UPDATE', dashboardData.metrics);
  socket.emit('QUEUE_UPDATE', dashboardData.actionQueue);
  socket.emit('COMPLETION_UPDATE', dashboardData.recentCompletions);
  socket.emit('STATUS_UPDATE', dashboardData.systemStatus);
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Function to update data from Vee Otto agent
export function updateFromAgent(data: {
  actionQueue?: ActionQueueItem[],
  completion?: RecentCompletion,
  metrics?: Partial<DashboardMetrics>,
  systemStatus?: Partial<SystemStatus>
}) {
  if (data.actionQueue) {
    dashboardData.actionQueue = data.actionQueue;
    io.emit('QUEUE_UPDATE', dashboardData.actionQueue);
  }
  
  if (data.completion) {
    dashboardData.recentCompletions = [
      data.completion,
      ...dashboardData.recentCompletions
    ].slice(0, 10);
    io.emit('COMPLETION_UPDATE', dashboardData.recentCompletions);
  }
  
  if (data.metrics) {
    dashboardData.metrics = { ...dashboardData.metrics, ...data.metrics };
    io.emit('METRICS_UPDATE', dashboardData.metrics);
  }
  
  if (data.systemStatus) {
    dashboardData.systemStatus = { ...dashboardData.systemStatus, ...data.systemStatus };
    io.emit('STATUS_UPDATE', dashboardData.systemStatus);
  }
}

// Serve frontend for all non-API routes
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../dist/dashboard/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Dashboard available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

export { app, httpServer, io };
