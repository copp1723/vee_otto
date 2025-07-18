import { Page } from 'playwright';
import { Logger } from '../utils/Logger';

export interface TaskContext {
  page: Page;
  logger: Logger;
  [key: string]: any;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export abstract class BaseTask {
  protected name: string;
  protected description: string;
  protected dependencies: string[];
  protected timeout: number;
  protected retryCount: number;

  constructor(
    name: string,
    description: string = '',
    dependencies: string[] = [],
    timeout: number = 30000,
    retryCount: number = 3
  ) {
    this.name = name;
    this.description = description;
    this.dependencies = dependencies;
    this.timeout = timeout;
    this.retryCount = retryCount;
  }

  abstract execute(context: TaskContext): Promise<TaskResult>;

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getDependencies(): string[] {
    return this.dependencies;
  }

  getTimeout(): number {
    return this.timeout;
  }

  getRetryCount(): number {
    return this.retryCount;
  }
}