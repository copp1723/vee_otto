export interface DashboardMetrics {
    noPricePending: {
        current: number;
        total: number;
        percentageReduction: number;
    };
    timeSaved: {
        hours: number;
        formatted: string;
    };
    valueProtected: {
        amount: number;
        formatted: string;
    };
}
export interface ActionQueueItem {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    issueType: 'NO_STICKER' | 'LOW_CONFIDENCE' | 'MISSING_DATA';
    issueDescription: string;
    estimatedTime: number;
}
export interface RecentCompletion {
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    completedAt: string;
    timeSaved: number;
    valueProtected: number;
    outcome: string;
}
export interface PerformanceData {
    date: string;
    vehiclesProcessed: number;
    timeSaved: number;
    valueProtected: number;
}
export interface SystemStatus {
    operational: boolean;
    lastUpdate: string;
    activeAgents: number;
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
    timestamp: string;
}
export interface WebSocketMessage {
    type: 'METRICS_UPDATE' | 'QUEUE_UPDATE' | 'COMPLETION_UPDATE' | 'STATUS_UPDATE';
    payload: any;
    timestamp: string;
}
export interface MetricTileProps {
    title: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    loading?: boolean;
}
export interface ActionQueueProps {
    items: ActionQueueItem[];
    onProcessAll: () => void;
    onViewAll: () => void;
    loading?: boolean;
}
export interface RecentCompletionsProps {
    completions: RecentCompletion[];
    loading?: boolean;
}
export interface PerformanceChartProps {
    data: PerformanceData[];
    loading?: boolean;
}
//# sourceMappingURL=index.d.ts.map