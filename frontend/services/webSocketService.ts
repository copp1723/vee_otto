import { io, Socket } from 'socket.io-client';
import { WebSocketMessage } from '../types';

type WebSocketEventHandler = (data: any) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();

  connect(): void {
    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3000';

    this.socket = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Listen for specific event types
    this.socket.on('METRICS_UPDATE', (data) => {
      this.handleMessage({ type: 'METRICS_UPDATE', payload: data, timestamp: new Date().toISOString() });
    });

    this.socket.on('QUEUE_UPDATE', (data) => {
      this.handleMessage({ type: 'QUEUE_UPDATE', payload: data, timestamp: new Date().toISOString() });
    });

    this.socket.on('COMPLETION_UPDATE', (data) => {
      this.handleMessage({ type: 'COMPLETION_UPDATE', payload: data, timestamp: new Date().toISOString() });
    });

    this.socket.on('STATUS_UPDATE', (data) => {
      this.handleMessage({ type: 'STATUS_UPDATE', payload: data, timestamp: new Date().toISOString() });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => {
      try {
        handler(message.payload);
      } catch (error) {
        console.error(`Error handling WebSocket message of type ${message.type}:`, error);
      }
    });
  }

  subscribe(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    const handlers = this.eventHandlers.get(eventType)!;
    handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();
