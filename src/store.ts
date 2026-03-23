import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { FocusDB, Task, TaskStatus, TaskPriority } from './types.js';

const FOCUS_DIR = path.join(os.homedir(), '.focus');
const DB_PATH = path.join(FOCUS_DIR, 'db.json');

function defaultDB(): FocusDB {
  return {
    tasks: [],
    nextId: 1,
    session: {
      lastActiveTaskId: null,
      lastOpenedAt: new Date().toISOString(),
      selectedIndex: 0,
      viewFilter: 'all',
      timer: { taskId: null, startedAt: null, duration: 25, paused: false, elapsed: 0 },
      focusStartedAt: null,
    },
  };
}

function ensureDir(): void {
  if (!fs.existsSync(FOCUS_DIR)) {
    fs.mkdirSync(FOCUS_DIR, { recursive: true });
  }
}

export function load(): FocusDB {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDB();
    save(db);
    return db;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(raw) as FocusDB;
  // Always keep nextId in sync with actual tasks
  db.nextId = db.tasks.length > 0 ? Math.max(...db.tasks.map(t => t.id)) + 1 : 1;
  return db;
}

export function save(db: FocusDB): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

export function addTask(db: FocusDB, title: string, priority: TaskPriority = 'medium'): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: db.nextId++,
    title,
    status: 'active',
    priority,
    subtasks: [],
    tags: [],
    notes: [],
    timeSpent: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.tasks.push(task);
  save(db);
  return task;
}

export function setStatus(db: FocusDB, id: number, status: TaskStatus, reason?: string): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return null;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (status === 'blocked' && reason) {
    task.blockedReason = reason;
  }
  if (status === 'done') {
    task.doneAt = new Date().toISOString();
  }
  if (status === 'active') {
    task.blockedReason = undefined;
  }
  save(db);
  return task;
}

export function deleteTask(db: FocusDB, id: number): boolean {
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  db.tasks.splice(idx, 1);
  // Remove from any parent's subtasks list
  for (const t of db.tasks) {
    if (t.subtasks) {
      t.subtasks = t.subtasks.filter(sid => sid !== id);
    }
  }
  // Recalculate nextId so deleted IDs can be reused
  db.nextId = db.tasks.length > 0 ? Math.max(...db.tasks.map(t => t.id)) + 1 : 1;
  save(db);
  return true;
}

export function linkBranch(db: FocusDB, id: number, branch: string): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return null;
  task.gitBranch = branch;
  task.updatedAt = new Date().toISOString();
  save(db);
  return task;
}

export function setPriority(db: FocusDB, id: number, priority: TaskPriority): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return null;
  task.priority = priority;
  task.updatedAt = new Date().toISOString();
  save(db);
  return task;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function getFilteredTasks(db: FocusDB, filter: 'all' | 'active' | 'blocked' | 'done' | 'archive'): Task[] {
  let filtered: Task[];
  if (filter === 'all') {
    filtered = db.tasks.filter(t => t.status !== 'done');
  } else if (filter === 'archive') {
    filtered = db.tasks.filter(t => t.status === 'done');
  } else {
    filtered = db.tasks.filter(t => t.status === filter);
  }
  return filtered.sort((a, b) => PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium']);
}

export function moveTask(db: FocusDB, id: number, direction: 'up' | 'down'): boolean {
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= db.tasks.length) return false;
  [db.tasks[idx], db.tasks[target]] = [db.tasks[target], db.tasks[idx]];
  save(db);
  return true;
}

export function addSubtask(db: FocusDB, parentId: number, title: string): Task | null {
  const parent = db.tasks.find(t => t.id === parentId);
  if (!parent) return null;
  const task = addTask(db, title);
  task.parentId = parentId;
  if (!parent.subtasks) parent.subtasks = [];
  parent.subtasks.push(task.id);
  save(db);
  return task;
}

export function getCurrentBranch(): string | null {
  try {
    const { execSync } = require('node:child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function getBranchStatus(branch: string): { ahead: number; behind: number; dirty: boolean } | null {
  try {
    const { execSync } = require('node:child_process');
    const run = (cmd: string) => execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const currentBranch = run('git rev-parse --abbrev-ref HEAD');
    if (currentBranch !== branch) return null;
    let ahead = 0, behind = 0;
    try {
      const counts = run(`git rev-list --left-right --count ${branch}...@{upstream}`);
      [ahead, behind] = counts.split('\t').map(Number);
    } catch { /* no upstream */ }
    const dirty = run('git status --porcelain').length > 0;
    return { ahead, behind, dirty };
  } catch {
    return null;
  }
}

export function createBranchFromTask(task: { id: number; title: string }): string | null {
  try {
    const { execSync } = require('node:child_process');
    const slug = task.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const branch = `task/${task.id}-${slug}`;
    execSync(`git checkout -b ${branch}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    return branch;
  } catch {
    return null;
  }
}

export function findTaskByBranch(db: FocusDB, branch: string): Task | null {
  return db.tasks.find(t => t.gitBranch === branch) ?? null;
}
