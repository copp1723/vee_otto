# vAuto Intelligence Suite - Operations Dashboard

## Overview

This is the Operations Dashboard for the vAuto Intelligence Suite, providing real-time monitoring and management capabilities for automated vehicle processing. The dashboard displays key metrics, vehicles requiring attention, recent completions, and performance trends.

## Features

### Dashboard Components

1. **Key Metrics Display**
   - No Price/Pending count with percentage reduction
   - Time Saved Today in hours
   - Value Protected in dollars

2. **Action Required Queue**
   - Scrollable list of vehicles needing manual review
   - Process All functionality
   - Issue categorization (No Sticker, Low Confidence, Missing Data)

3. **Recent Completions Feed**
   - Last 5 successfully processed vehicles
   - Auto-refresh every 30 seconds
   - Completion outcomes and metrics

4. **Performance Chart**
   - 7-day trends for vehicle processing, time saved, and value protected
   - Interactive chart with metric toggles
   - Responsive design with custom styling

### Technical Features

- **Real-time Updates**: WebSocket integration for live data updates
- **Responsive Design**: Mobile-friendly interface with breakpoints at 768px and 480px
- **Accessibility**: WCAG 2.1 AA compliant with proper ARIA labels
- **Error Handling**: Comprehensive error boundaries and loading states
- **TypeScript**: Fully typed with strict mode enabled
- **CSS Modules**: Scoped styling with custom orange accent theme

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- The backend automation services should be running

### Installation

1. Install dependencies:
```bash
npm install
```

2. Build the TypeScript backend (if needed):
```bash
npm run build
```

### Development

1. Start the frontend development server:
```bash
npm run dashboard:dev
```

2. The dashboard will be available at `http://localhost:3000`

### Production Build

1. Build the frontend for production:
```bash
npm run dashboard:build
```

2. Built files will be in `dist/frontend/`

## Architecture

### Frontend Structure
```
src/frontend/
├── pages/Dashboard/           # Main dashboard page
│   ├── components/
│   │   ├── MetricTile/       # Individual metric display
│   │   ├── ActionQueue/      # Vehicles requiring attention
│   │   ├── RecentCompletions/# Recently processed vehicles
│   │   └── PerformanceChart/ # 7-day performance trends
│   ├── index.tsx            # Dashboard main component
│   └── Dashboard.module.css # Dashboard styles
├── services/                # API and WebSocket services
├── types/                   # TypeScript interfaces
└── index.tsx               # React application entry point
```

### Data Flow

1. **Initial Load**: Dashboard fetches all data via REST API
2. **Real-time Updates**: WebSocket connection provides live updates
3. **Auto-refresh**: Recent completions refresh every 30 seconds
4. **Error Handling**: Graceful degradation with retry mechanisms

### API Endpoints

The dashboard expects the following API endpoints:

- `GET /api/dashboard/metrics` - Current metrics
- `GET /api/dashboard/action-queue` - Vehicles requiring attention
- `GET /api/dashboard/recent-completions` - Recently completed vehicles
- `GET /api/dashboard/performance-chart` - 7-day performance data
- `GET /api/dashboard/status` - System operational status
- `POST /api/dashboard/process-all` - Process all queued items
- `WS /ws/dashboard-updates` - WebSocket for real-time updates

### Mock Data

For development and testing, the dashboard includes comprehensive mock data that simulates:

- Real vehicle data with VINs, makes, models
- Various issue types and statuses
- Performance metrics over time
- Realistic timestamps and values

## Styling

### Color Palette
- **Primary Orange**: `#ff9500`
- **Orange Dark**: `#e67e00` (hover states)
- **Orange Light**: `#fff4e6` (backgrounds)
- **Orange Border**: `#ffb84d` (borders)

### Typography
- **Section Headers**: 18px, weight 600, uppercase
- **Body Text**: 14px, line-height 1.6
- **Metric Values**: 32px, weight 600
- **Labels**: 12px, uppercase, letter-spacing 0.5px

### Responsive Breakpoints
- **Desktop**: > 768px (40px padding)
- **Tablet**: ≤ 768px (20px padding)
- **Mobile**: ≤ 480px (optimized layout)

## Performance Requirements

- **Initial Load**: < 2 seconds
- **Real-time Updates**: < 100ms latency
- **Memory Usage**: Optimized for long-running sessions
- **Bundle Size**: Minimized with code splitting

## Testing

Run tests with:
```bash
npm test
```

### Test Coverage Requirements
- Unit tests for all utility functions
- Component tests for metric calculations
- Integration tests for API calls
- Visual regression tests for responsive layouts

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## Development Notes

1. **Mock vs Real API**: Set `NODE_ENV=development` to use mock data
2. **WebSocket Fallback**: Graceful degradation if WebSocket fails
3. **Performance Monitoring**: Development console logs performance metrics
4. **Error Boundaries**: Comprehensive error handling with user-friendly messages

## Deployment

The dashboard is designed to be deployed alongside the backend services. For production:

1. Build the frontend: `npm run dashboard:build`
2. Serve static files from `dist/frontend/`
3. Ensure backend API endpoints are available
4. Configure WebSocket proxy if needed

## Contributing

1. Follow TypeScript strict mode guidelines
2. Maintain CSS Modules naming conventions
3. Add proper ARIA labels for accessibility
4. Include loading and error states for all components
5. Test responsive behavior at all breakpoints

## Support

For technical support or questions about the dashboard implementation, please refer to the main project documentation or contact the development team.
