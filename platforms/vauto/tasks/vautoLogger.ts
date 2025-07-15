// Centralized error logger for VAutoTasks
export const vautoLogger = {
  info: (...args: any[]) => console.info('[VAuto]', ...args),
  warn: (...args: any[]) => console.warn('[VAuto]', ...args),
  error: (...args: any[]) => console.error('[VAuto]', ...args)
};
