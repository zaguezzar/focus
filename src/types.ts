export type TaskStatus = 'active' | 'blocked' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  blockedReason?: string;
  gitBranch?: string;
  timeSpent: number; // total seconds spent working on this task
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
}

export interface TimerState {
  taskId: number | null;
  startedAt: string | null;
  duration: number; // minutes
  paused: boolean;
  elapsed: number; // seconds elapsed before pause
}

export interface SessionContext {
  lastActiveTaskId: number | null;
  lastOpenedAt: string;
  selectedIndex: number;
  viewFilter: 'all' | 'active' | 'blocked' | 'done';
  timer: TimerState;
  focusStartedAt: string | null; // when the user started focusing on a task
}

export interface FocusDB {
  tasks: Task[];
  nextId: number;
  session: SessionContext;
}
