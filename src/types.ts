export type TaskStatus = 'active' | 'blocked' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  blockedReason?: string;
  gitBranch?: string;
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
}

export interface SessionContext {
  lastActiveTaskId: number | null;
  lastOpenedAt: string;
  selectedIndex: number;
  viewFilter: 'all' | 'active' | 'blocked' | 'done';
}

export interface FocusDB {
  tasks: Task[];
  nextId: number;
  session: SessionContext;
}
