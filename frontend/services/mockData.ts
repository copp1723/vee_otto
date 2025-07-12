import { 
  DashboardMetrics, 
  ActionQueueItem, 
  RecentCompletion, 
  PerformanceData,
  SystemStatus 
} from '../types';

// Mock data for development and testing
export const mockDashboardMetrics: DashboardMetrics = {
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
};

export const mockActionQueue: ActionQueueItem[] = [
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
  {
    id: 'aq-003',
    vin: '3KPF24AD5KE123789',
    year: 2019,
    make: 'Kia',
    model: 'Rio',
    issueType: 'MISSING_DATA',
    issueDescription: 'Year and mileage data incomplete',
    estimatedTime: 3,
  },
  {
    id: 'aq-004',
    vin: '5NPE34AF2GH123456',
    year: 2016,
    make: 'Hyundai',
    model: 'Elantra',
    issueType: 'NO_STICKER',
    issueDescription: 'Vehicle not found in inventory system',
    estimatedTime: 10,
  },
  {
    id: 'aq-005',
    vin: '1N4AL3AP9JC123789',
    year: 2018,
    make: 'Nissan',
    model: 'Altima',
    issueType: 'LOW_CONFIDENCE',
    issueDescription: 'Price recognition unclear due to lighting',
    estimatedTime: 6,
  },
];

export const mockRecentCompletions: RecentCompletion[] = [
  {
    id: 'rc-001',
    vin: '1FTEW1E55KF123456',
    year: 2019,
    make: 'Ford',
    model: 'F-150',
    completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
    timeSaved: 12,
    valueProtected: 2850,
    outcome: 'Price adjusted to market value',
  },
  {
    id: 'rc-002',
    vin: '3VWDB7AJ8GM123789',
    year: 2016,
    make: 'Volkswagen',
    model: 'Passat',
    completedAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(), // 32 minutes ago
    timeSaved: 8,
    valueProtected: 1240,
    outcome: 'Duplicate listing removed',
  },
  {
    id: 'rc-003',
    vin: '1C4RJFAG0EC123456',
    year: 2014,
    make: 'Jeep',
    model: 'Cherokee',
    completedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
    timeSaved: 15,
    valueProtected: 3200,
    outcome: 'Pricing optimized for faster sale',
  },
  {
    id: 'rc-004',
    vin: '2HKRM4H78GH123789',
    year: 2016,
    make: 'Honda',
    model: 'Pilot',
    completedAt: new Date(Date.now() - 1000 * 60 * 58).toISOString(), // 58 minutes ago
    timeSaved: 6,
    valueProtected: 890,
    outcome: 'Vehicle description enhanced',
  },
  {
    id: 'rc-005',
    vin: 'WVWZZZ3CZGE123456',
    year: 2016,
    make: 'Volkswagen',
    model: 'Golf',
    completedAt: new Date(Date.now() - 1000 * 60 * 72).toISOString(), // 72 minutes ago
    timeSaved: 10,
    valueProtected: 1750,
    outcome: 'Market analysis completed',
  },
];

export const mockPerformanceData: PerformanceData[] = [
  { date: '2025-07-05', vehiclesProcessed: 45, timeSaved: 8.5, valueProtected: 32400 },
  { date: '2025-07-06', vehiclesProcessed: 52, timeSaved: 9.2, valueProtected: 38750 },
  { date: '2025-07-07', vehiclesProcessed: 38, timeSaved: 7.1, valueProtected: 28950 },
  { date: '2025-07-08', vehiclesProcessed: 61, timeSaved: 11.3, valueProtected: 45200 },
  { date: '2025-07-09', vehiclesProcessed: 48, timeSaved: 8.9, valueProtected: 35600 },
  { date: '2025-07-10', vehiclesProcessed: 55, timeSaved: 10.2, valueProtected: 41300 },
  { date: '2025-07-11', vehiclesProcessed: 42, timeSaved: 7.8, valueProtected: 31850 },
];

export const mockSystemStatus: SystemStatus = {
  operational: true,
  lastUpdate: new Date().toISOString(),
  activeAgents: 3,
};

// Mock API service for development
export class MockApiService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await this.delay(300);
    return mockDashboardMetrics;
  }

  async getActionQueue(): Promise<ActionQueueItem[]> {
    await this.delay(400);
    return mockActionQueue;
  }

  async getRecentCompletions(): Promise<RecentCompletion[]> {
    await this.delay(350);
    return mockRecentCompletions;
  }

  async getPerformanceData(): Promise<PerformanceData[]> {
    await this.delay(500);
    return mockPerformanceData;
  }

  async getSystemStatus(): Promise<SystemStatus> {
    await this.delay(200);
    return mockSystemStatus;
  }

  async processAllItems(): Promise<void> {
    await this.delay(1000);
    console.log('Mock: Processing all items...');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockApiService = new MockApiService();
