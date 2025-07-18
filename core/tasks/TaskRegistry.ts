import { BaseTask } from './BaseTask';

export class TaskRegistry {
  private static registry: Map<string, new (...args: any[]) => BaseTask> = new Map();

  static register(taskName: string, taskClass: new (...args: any[]) => BaseTask): void {
    this.registry.set(taskName, taskClass);
  }

  static getTask(taskName: string): BaseTask | undefined {
    const TaskClass = this.registry.get(taskName);
    if (TaskClass) {
      return new TaskClass();
    }
    return undefined;
  }

  static getAllTaskNames(): string[] {
    return Array.from(this.registry.keys());
  }

  static hasTask(taskName: string): boolean {
    return this.registry.has(taskName);
  }

  static clear(): void {
    this.registry.clear();
  }
}

// Register available tasks
import { FactoryEquipmentTask } from '../../platforms/vauto/tasks/FactoryEquipmentTask';
TaskRegistry.register('FactoryEquipment', FactoryEquipmentTask);