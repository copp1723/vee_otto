export interface ErrorReport {
  timestamp: number;
  error: Error | string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export class ErrorReporter {
  private errors: ErrorReport[] = [];

  reportError(error: Error | string, context: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', metadata?: Record<string, any>): void {
    this.errors.push({
      timestamp: Date.now(),
      error,
      context,
      severity,
      metadata
    });
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  getErrorsByContext(context: string): ErrorReport[] {
    return this.errors.filter(err => err.context === context);
  }

  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorReport[] {
    return this.errors.filter(err => err.severity === severity);
  }
}