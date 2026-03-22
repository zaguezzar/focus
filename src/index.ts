#!/usr/bin/env node

import * as store from './store.js';
import { launchUI } from './ui.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  console.log(`
  focus - context-aware task brain

  Usage:
    focus                   Open interactive UI
    focus add "task"        Add a new task
    focus done <id>         Mark task as done
    focus block <id> "why"  Block a task with reason
    focus activate <id>     Reactivate a blocked/done task
    focus list              List active tasks
    focus link <id>         Link current git branch to task
    focus now               Show current focused task
    focus pick              Suggest a random active task
    focus prompt            Minimal output for shell PS1
    focus help              Show this help

  UI Keys:
    j/k, arrows   Navigate tasks
    Tab            Cycle filters (all/active/blocked/done)
    1-4            Jump to filter
    a              Add task
    d              Mark done
    b              Block (with reason)
    r              Reactivate
    e              Edit title
    g              Link git branch
    x              Delete task
    Enter          Set as current focus
    q              Quit
`);
}

function printTask(task: { id: number; title: string; status: string; blockedReason?: string; gitBranch?: string }): void {
  const icons: Record<string, string> = { active: '\u25CF', blocked: '\u25A0', done: '\u2714' };
  const icon = icons[task.status] || ' ';
  const branch = task.gitBranch ? ` [${task.gitBranch}]` : '';
  const reason = task.blockedReason ? ` (${task.blockedReason})` : '';
  console.log(`  ${icon} #${task.id} ${task.title}${branch}${reason}`);
}

if (!command) {
  launchUI();
} else if (command === 'add') {
  const title = args.slice(1).join(' ');
  if (!title) {
    console.error('Usage: focus add "task title"');
    process.exit(1);
  }
  const db = store.load();
  const task = store.addTask(db, title);
  console.log(`Added task #${task.id}: ${task.title}`);
} else if (command === 'done') {
  const id = parseInt(args[1], 10);
  if (isNaN(id)) {
    console.error('Usage: focus done <id>');
    process.exit(1);
  }
  const db = store.load();
  const task = store.setStatus(db, id, 'done');
  if (task) {
    console.log(`Done: #${task.id} ${task.title}`);
  } else {
    console.error(`Task #${id} not found`);
    process.exit(1);
  }
} else if (command === 'block') {
  const id = parseInt(args[1], 10);
  const reason = args.slice(2).join(' ') || 'no reason given';
  if (isNaN(id)) {
    console.error('Usage: focus block <id> "reason"');
    process.exit(1);
  }
  const db = store.load();
  const task = store.setStatus(db, id, 'blocked', reason);
  if (task) {
    console.log(`Blocked: #${task.id} ${task.title} (${reason})`);
  } else {
    console.error(`Task #${id} not found`);
    process.exit(1);
  }
} else if (command === 'activate') {
  const id = parseInt(args[1], 10);
  if (isNaN(id)) {
    console.error('Usage: focus activate <id>');
    process.exit(1);
  }
  const db = store.load();
  const task = store.setStatus(db, id, 'active');
  if (task) {
    console.log(`Activated: #${task.id} ${task.title}`);
  } else {
    console.error(`Task #${id} not found`);
    process.exit(1);
  }
} else if (command === 'list') {
  const db = store.load();
  const filter = (args[1] as 'active' | 'blocked' | 'done' | 'all') || 'all';
  const tasks = store.getFilteredTasks(db, filter);
  if (tasks.length === 0) {
    console.log('  No tasks.');
  } else {
    tasks.forEach(printTask);
  }
} else if (command === 'link') {
  const id = parseInt(args[1], 10);
  if (isNaN(id)) {
    console.error('Usage: focus link <id>');
    process.exit(1);
  }
  const db = store.load();
  const branch = store.getCurrentBranch();
  if (!branch) {
    console.error('Not in a git repository');
    process.exit(1);
  }
  const task = store.linkBranch(db, id, branch);
  if (task) {
    console.log(`Linked #${task.id} to branch: ${branch}`);
  } else {
    console.error(`Task #${id} not found`);
    process.exit(1);
  }
} else if (command === 'now') {
  const db = store.load();
  const id = db.session.lastActiveTaskId;
  if (id === null) {
    console.log('No task focused');
  } else {
    const task = db.tasks.find(t => t.id === id);
    if (task) {
      printTask(task);
    } else {
      console.log('No task focused');
    }
  }
} else if (command === 'pick') {
  const db = store.load();
  const active = db.tasks.filter(t => t.status === 'active');
  if (active.length === 0) {
    console.log('No active tasks to pick from');
  } else {
    const pick = active[Math.floor(Math.random() * active.length)];
    console.log(`\n  How about this one?\n`);
    printTask(pick);
    console.log('');
  }
} else if (command === 'prompt') {
  // For shell prompt integration: outputs minimal text for PS1
  const db = store.load();
  const id = db.session.lastActiveTaskId;
  if (id !== null) {
    const task = db.tasks.find(t => t.id === id);
    if (task) {
      process.stdout.write(`[#${task.id} ${task.title}]`);
    }
  }
} else if (command === 'help' || command === '--help' || command === '-h') {
  printHelp();
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
