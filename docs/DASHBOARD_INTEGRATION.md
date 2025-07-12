# Vee Otto Dashboard Integration Guide

## Overview

The Vee Otto Operations Dashboard provides real-time monitoring and management of the automated vAuto CRM processing. This guide covers backend integration, API endpoints, and deployment instructions.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vee Otto      │────▶│  Backend Server  │────▶│   Dashboard UI  │
│   Agent         │     │  (Express/WS)   │     │   (React)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       ▼                         │
         │              ┌──────────────────┐              │
         └─────────────▶│  Database/State  │◀─────────────┘
                        └──────────────────┘
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file:
```env
# Server Configuration
PORT=3000
JWT_SECRET=your-secure-jwt-secret
ADMIN_USER=admin
ADMIN_PASS=secure-password

# Frontend URLs
FRONTEND_URL=http://localhost:8080
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_WS_URL=http://localhost:3000

# Dashboard Settings
DASHBOARD_PORT=8080
```

### 3. Start Development Servers
```bash
# Terminal 1: Backend Server
npm run server:dev

# Terminal 2: Dashboard Frontend
npm run dashboard:dev
```

### 4. Production Build & Deployment
```bash
# Build frontend
npm run dashboard:build

# Build backend
npm run server:build

# Start production server
npm run dashboard:prod
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```

### Dashboard Data
- `GET /api/metrics` - Get dashboard metrics
- `GET /api/action-queue` - Get pending actions
- `GET /api/recent-completions` - Get recent completions
- `GET /api/performance` - Get performance data
- `GET /api/system-status` - Get system status
- `POST /api/process-queue` - Process all queue items

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## WebSocket Events

The server emits real-time updates via WebSocket:

- `METRICS_UPDATE` - Dashboard metrics updated
- `QUEUE_UPDATE` - Action queue changed
- `COMPLETION_UPDATE` - New completion recorded
- `STATUS_UPDATE` - System status changed

## Integration with Vee Otto Agent

### Using DashboardIntegration

```typescript
import { dashboardIntegration } from './src/DashboardIntegration';

// Add vehicle to action queue
await dashboardIntegration.addToActionQueue({
  vin: '1HGBH41JXMN109186',
  year: 2021,
  make: 'Honda',
  model: 'Civic',
  issue: 'NO_STICKER',
  description: 'Window sticker not found',
  estimatedTime: 5
});

// Report completion
await dashboardIntegration.reportCompletion({
  vin: '1HGBH41JXMN109186',
  year: 2021,
  make: 'Honda',
  model: 'Civic',
  timeSaved: 12,
  valueProtected: 2500,
  outcome: 'Features updated successfully'
});

// Update metrics
await dashboardIntegration.updateMetrics({
  noPricePending: { current: 15, total: 100 },
  timeSavedToday: 180, // minutes
  valueProtectedToday: 45000
});

// Batch update from agent run
await dashboardIntegration.reportAgentRun({
  dealershipName: 'ABC Motors',
  vehiclesProcessed: 25,
  vehiclesWithIssues: [...],
  completedVehicles: [...],
  totalTimeSaved: 300,
  totalValueProtected: 75000
});
```

### Direct Server Integration

For custom integrations, use the `updateFromAgent` function:

```typescript
import { updateFromAgent } from './src/server';

updateFromAgent({
  actionQueue: updatedQueueArray,
  completion: newCompletionRecord,
  metrics: partialMetricsUpdate,
  systemStatus: statusUpdate
});
```

## Testing

### Run E2E Tests
```bash
# Run all tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### Test Coverage Requirements
- Dashboard load: 95%+ success rate
- Mobile responsive: All viewports
- Real-time updates: <2s latency
- Queue processing: <20 items simulation
- Error boundaries: Graceful failures

## Security

### Authentication Flow
1. User logs in with credentials
2. Server validates and returns JWT token
3. Frontend stores token in localStorage
4. All API requests include token in Authorization header
5. Server validates token on each request

### Best Practices
- Use HTTPS in production
- Set strong JWT_SECRET
- Implement rate limiting
- Enable CORS restrictions
- Regular security audits

## Monitoring & Logs

Logs are written to:
- `logs/server.log` - Backend server logs
- `logs/dashboard-integration.log` - Integration events

Monitor key metrics:
- API response times
- WebSocket connection count
- Queue processing rate
- Error rates

## Troubleshooting

### Common Issues

1. **Dashboard not loading**
   - Check server is running on correct port
   - Verify authentication token
   - Check browser console for errors

2. **WebSocket disconnections**
   - Check firewall/proxy settings
   - Verify WebSocket URL configuration
   - Monitor server logs for errors

3. **Data not updating**
   - Verify agent integration is active
   - Check WebSocket connection status
   - Review server logs for update events

## Performance Optimization

1. **Frontend**
   - Lazy load chart components
   - Implement virtual scrolling for large queues
   - Use React.memo for optimization

2. **Backend**
   - Implement database for persistence
   - Add Redis for caching
   - Use connection pooling

3. **Scaling**
   - Deploy behind load balancer
   - Use PM2 for process management
   - Implement horizontal scaling

## Future Enhancements

- [ ] Historical data analytics
- [ ] Multi-dealership support
- [ ] Custom alert thresholds
- [ ] Export functionality
- [ ] Mobile app version
- [ ] Advanced filtering options
- [ ] Batch operations UI
- [ ] Integration with vAuto API

## Support

For issues or questions:
1. Check logs for error details
2. Review this documentation
3. Create GitHub issue with details
4. Contact development team

---

Last Updated: July 2025
Version: 1.0.0
