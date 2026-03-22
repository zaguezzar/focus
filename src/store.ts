import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { FocusDB, Task, TaskStatus } from './types.js';

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
  return JSON.parse(raw) as FocusDB;
}

export function save(db: FocusDB): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

export function addTask(db: FocusDB, title: string): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: db.nextId++,
    title,
    status: 'active',
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

export function getFilteredTasks(db: FocusDB, filter: 'all' | 'active' | 'blocked' | 'done'): Task[] {
  if (filter === 'all') {
    return db.tasks.filter(t => t.status !== 'done');
  }
  return db.tasks.filter(t => t.status === filter);
}

export function getCurrentBranch(): string | null {
  try {
    const { execSync } = require('node:child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}
