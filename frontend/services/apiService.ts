import axios, { AxiosInstance } from 'axios';
import { 
  DashboardMetrics, 
  ActionQueueItem, 
  RecentCompletion, 
  PerformanceData,
  SystemStatus,
  ApiResponse 
} from '../types';

class ApiService {
  private axiosInstance: AxiosInstance;
  private token: string | null = null;

  constructor() {
    // Debug: Log environment and URL configuration
    console.log('API Service Configuration:', {
      NODE_ENV: process.env.NODE_ENV,
      windowLocation: window.location.origin,
      baseURL: process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api`
        : 'http://localhost:10000/api'
    });

    // Use window.location.origin for production to handle Render's dynamic URLs
    const baseURL = process.env.NODE_ENV === 'production'
      ? `${window.location.origin}/api`
      : (process.env.REACT_APP_API_URL || 'http://localhost:10000/api');
    
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 10000,
    });

    // Add auth token to requests
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Handle auth errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Token expired or invalid, redirect to login
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('authToken');
    }
    console.log('apiService: Getting token - exists:', !!this.token);
    return this.token;
  }

  clearToken() {
    console.log('apiService: Clearing token');
    this.token = null;
    localStorage.removeItem('authToken');
  }

  async login(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    console.log('apiService: Attempting login for username:', username);
    try {
      const response = await this.axiosInstance.post('/auth/login', { username, password });
      console.log('apiService: Login response:', response.data);
      if (response.data.success && response.data.token) {
        this.setToken(response.data.token);
        console.log('apiService: Token set successfully');
      }
      return response.data;
    } catch (error: any) {
      console.error('apiService: Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  }

  // Dashboard API methods
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await this.axiosInstance.get<ApiResponse<DashboardMetrics>>('/metrics');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch metrics');
    }
    return response.data.data;
  }

  async getActionQueue(): Promise<ActionQueueItem[]> {
    const response = await this.axiosInstance.get<ApiResponse<ActionQueueItem[]>>('/action-queue');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch action queue');
    }
    return response.data.data;
  }

  async getRecentCompletions(): Promise<RecentCompletion[]> {
    const response = await this.axiosInstance.get<ApiResponse<RecentCompletion[]>>('/recent-completions');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch recent completions');
    }
    return response.data.data;
  }

  async getPerformanceData(): Promise<PerformanceData[]> {
    const response = await this.axiosInstance.get<ApiResponse<PerformanceData[]>>('/performance');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch performance data');
    }
    return response.data.data;
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const response = await this.axiosInstance.get<ApiResponse<SystemStatus>>('/system-status');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch system status');
    }
    return response.data.data;
  }

  async processAllItems(): Promise<void> {
    const response = await this.axiosInstance.post<ApiResponse<{ processedCount: number }>>('/process-queue');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to process queue');
    }
  }

  async startAutomation(): Promise<{ message: string }> {
    console.log('apiService: Starting automation...');
    const response = await this.axiosInstance.post<ApiResponse<{ message: string }>>('/automation/start');
    console.log('apiService: Start automation response:', response.data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start automation');
    }
    return response.data.data;
  }
}

export const apiService = new ApiService();
