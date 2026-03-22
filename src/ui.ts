import blessed from 'blessed';
import type { FocusDB, Task, TaskPriority } from './types.js';
import * as store from './store.js';

const COLORS = {
  bg: '#1a1b26',
  fg: '#c0caf5',
  border: '#3b4261',
  headerBg: '#24283b',
  activeFg: '#7aa2f7',
  blockedFg: '#f7768e',
  doneFg: '#9ece6a',
  selectedBg: '#283457',
  accent: '#bb9af7',
  dimFg: '#565f89',
  inputBg: '#1f2335',
  highFg: '#f7768e',
  mediumFg: '#e0af68',
  lowFg: '#565f89',
};

type ViewFilter = 'all' | 'active' | 'blocked' | 'done';
const FILTERS: ViewFilter[] = ['all', 'active', 'blocked', 'done'];

export function launchUI(): void {
  let db = store.load();
  let selectedIndex = db.session.selectedIndex;
  let currentFilter: ViewFilter = db.session.viewFilter as ViewFilter;
  let tasks = store.getFilteredTasks(db, currentFilter);
  let searchQuery = '';
  let isSearching = false;

  const screen = blessed.screen({
    smartCSR: true,
    title: 'focus',
    fullUnicode: true,
    mouse: true,
  });

  // Header bar
  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    style: { bg: COLORS.headerBg, fg: COLORS.fg },
    content: '',
    tags: true,
  });

  // Task list
  const taskList = blessed.box({
    top: 3,
    left: 0,
    width: '100%-30',
    height: '100%-6',
    border: { type: 'line' },
    style: {
      border: { fg: COLORS.border },
      bg: COLORS.bg,
      fg: COLORS.fg,
    },
    tags: true,
    scrollable: true,
    mouse: true,
    keys: true,
    label: ' Tasks ',
  });

  // Detail panel
  const detailPanel = blessed.box({
    top: 3,
    right: 0,
    width: 30,
    height: '100%-6',
    border: { type: 'line' },
    style: {
      border: { fg: COLORS.border },
      bg: COLORS.bg,
      fg: COLORS.fg,
    },
    tags: true,
    label: ' Details ',
  });

  // Status bar
  const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    style: { bg: COLORS.headerBg, fg: COLORS.dimFg },
    content: '',
    tags: true,
  });

  // Input box (hidden by default)
  const inputBox = blessed.textbox({
    bottom: 3,
    left: 'center',
    width: '80%',
    height: 3,
    border: { type: 'line' },
    style: {
      border: { fg: COLORS.accent },
      bg: COLORS.inputBg,
      fg: COLORS.fg,
    },
    hidden: true,
    inputOnFocus: true,
    label: '',
    tags: true,
  });

  screen.append(header);
  screen.append(taskList);
  screen.append(detailPanel);
  screen.append(statusBar);
  screen.append(inputBox);

  function statusIcon(status: string): string {
    switch (status) {
      case 'active': return `{${COLORS.activeFg}-fg}\u25CF{/}`;
      case 'blocked': return `{${COLORS.blockedFg}-fg}\u25A0{/}`;
      case 'done': return `{${COLORS.doneFg}-fg}\u2714{/}`;
      default: return ' ';
    }
  }

  function renderHeader(): void {
    const filterTabs = FILTERS.map(f => {
      const count = f === 'all'
        ? db.tasks.filter(t => t.status !== 'done').length
        : db.tasks.filter(t => t.status === f).length;
      if (f === currentFilter) {
        return `{${COLORS.accent}-fg}{bold} [${f.toUpperCase()}] (${count}) {/bold}{/}`;
      }
      return `{${COLORS.dimFg}-fg} ${f} (${count}) {/}`;
    }).join('  ');

    const branch = store.getCurrentBranch();
    const branchStr = branch ? `{${COLORS.dimFg}-fg}git:{/}{${COLORS.activeFg}-fg}${branch}{/}` : '';

    header.setContent(`\n {${COLORS.accent}-fg}{bold}FOCUS{/bold}{/}  ${filterTabs}${'  '.repeat(3)}${branchStr}`);
  }

  function priorityTag(priority: TaskPriority): string {
    switch (priority) {
      case 'high': return `{${COLORS.highFg}-fg}!!{/}`;
      case 'medium': return `{${COLORS.mediumFg}-fg}!{/} `;
      case 'low': return `{${COLORS.lowFg}-fg}\u2022{/} `;
    }
  }

  function renderTasks(): void {
    let filtered = store.getFilteredTasks(db, currentFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || `#${t.id}` === q);
    }
    tasks = filtered;
    if (selectedIndex >= tasks.length) selectedIndex = Math.max(0, tasks.length - 1);
    taskList.setLabel(searchQuery ? ` Tasks {${COLORS.accent}-fg}/${searchQuery}{/} ` : ' Tasks ');

    if (tasks.length === 0) {
      taskList.setContent(`\n  {${COLORS.dimFg}-fg}No tasks. Press {/}{${COLORS.accent}-fg}a{/}{${COLORS.dimFg}-fg} to add one.{/}`);
      return;
    }

    const lines = tasks.map((task, i) => {
      const selected = i === selectedIndex;
      const prefix = selected ? `{${COLORS.selectedBg}-bg}` : '';
      const suffix = selected ? '{/}' : '';
      const icon = statusIcon(task.status);
      const prio = priorityTag(task.priority ?? 'medium');
      const id = `{${COLORS.dimFg}-fg}#${task.id}{/}`;
      const branchTag = task.gitBranch ? ` {${COLORS.dimFg}-fg}[${task.gitBranch}]{/}` : '';
      const blocked = task.status === 'blocked' && task.blockedReason
        ? ` {${COLORS.blockedFg}-fg}(${task.blockedReason}){/}`
        : '';
      const cursor = selected ? '{bold}>{/bold}' : ' ';
      return `${prefix} ${cursor} ${icon} ${prio} ${id} ${task.title}${branchTag}${blocked} ${suffix}`;
    });

    taskList.setContent('\n' + lines.join('\n'));
  }

  function renderDetail(): void {
    if (tasks.length === 0 || selectedIndex >= tasks.length) {
      detailPanel.setContent(`{${COLORS.dimFg}-fg}No task selected{/}`);
      return;
    }

    const task = tasks[selectedIndex];
    const lines = [
      `{bold}${task.title}{/bold}`,
      '',
      `{${COLORS.dimFg}-fg}ID:{/}      #${task.id}`,
      `{${COLORS.dimFg}-fg}Status:{/}  ${statusIcon(task.status)} ${task.status}`,
      `{${COLORS.dimFg}-fg}Priority:{/}${priorityTag(task.priority ?? 'medium')} ${task.priority ?? 'medium'}`,
    ];

    if (task.blockedReason) {
      lines.push(`{${COLORS.dimFg}-fg}Reason:{/}  {${COLORS.blockedFg}-fg}${task.blockedReason}{/}`);
    }
    if (task.gitBranch) {
      lines.push(`{${COLORS.dimFg}-fg}Branch:{/}  ${task.gitBranch}`);
    }

    lines.push('');
    lines.push(`{${COLORS.dimFg}-fg}Created:{/} ${formatDate(task.createdAt)}`);
    lines.push(`{${COLORS.dimFg}-fg}Updated:{/} ${formatDate(task.updatedAt)}`);
    if (task.doneAt) {
      lines.push(`{${COLORS.dimFg}-fg}Done:{/}    ${formatDate(task.doneAt)}`);
    }

    lines.push('');
    lines.push(`{${COLORS.dimFg}-fg}--- Actions ---{/}`);
    if (task.status === 'active') {
      lines.push(`{${COLORS.activeFg}-fg}[d]{/} done  {${COLORS.blockedFg}-fg}[b]{/} block`);
    } else if (task.status === 'blocked') {
      lines.push(`{${COLORS.activeFg}-fg}[r]{/} reactivate`);
    } else if (task.status === 'done') {
      lines.push(`{${COLORS.activeFg}-fg}[r]{/} reactivate`);
    }
    lines.push(`{${COLORS.accent}-fg}[p]{/} priority`);
    lines.push(`{${COLORS.accent}-fg}[g]{/} link branch`);
    lines.push(`{${COLORS.blockedFg}-fg}[x]{/} delete`);

    detailPanel.setContent(lines.join('\n'));
  }

  function renderStatusBar(): void {
    const key = (k: string, label: string) =>
      `{${COLORS.accent}-fg}[${k}]{/} {${COLORS.fg}-fg}${label}{/}`;
    const keys = [
      key('j/k', 'navigate'),
      key('Tab', 'filter'),
      key('a', 'add'),
      key('d', 'done'),
      key('b', 'block'),
      key('e', 'edit'),
      key('q', 'quit'),
    ].join('  ');
    const activeCount = db.tasks.filter(t => t.status === 'active').length;
    const blockedCount = db.tasks.filter(t => t.status === 'blocked').length;
    const taskCount = `{${COLORS.activeFg}-fg}${activeCount} active{/} {${COLORS.dimFg}-fg}/{/} {${COLORS.blockedFg}-fg}${blockedCount} blocked{/}`;
    statusBar.setContent(` ${keys}\n ${taskCount}`);
  }

  function render(): void {
    renderHeader();
    renderTasks();
    renderDetail();
    renderStatusBar();
    screen.render();
  }

  function saveSession(): void {
    db.session.selectedIndex = selectedIndex;
    db.session.viewFilter = currentFilter;
    db.session.lastOpenedAt = new Date().toISOString();
    if (tasks.length > 0 && selectedIndex < tasks.length) {
      db.session.lastActiveTaskId = tasks[selectedIndex].id;
    }
    store.save(db);
  }

  function promptInput(label: string, callback: (value: string) => void): void {
    inputBox.setLabel(` ${label} `);
    inputBox.setValue('');
    inputBox.hidden = false;
    inputBox.focus();
    screen.render();

    inputBox.once('submit', (value: string) => {
      inputBox.hidden = true;
      taskList.focus();
      if (value && value.trim()) {
        callback(value.trim());
      }
      render();
    });

    inputBox.once('cancel', () => {
      inputBox.hidden = true;
      taskList.focus();
      render();
    });

    inputBox.readInput();
  }

  // Navigation
  screen.key(['j', 'down'], () => {
    if (selectedIndex < tasks.length - 1) {
      selectedIndex++;
      render();
    }
  });

  screen.key(['k', 'up'], () => {
    if (selectedIndex > 0) {
      selectedIndex--;
      render();
    }
  });

  // Reorder tasks
  screen.key(['J'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0 || selectedIndex >= tasks.length - 1) return;
    const task = tasks[selectedIndex];
    store.moveTask(db, task.id, 'down');
    db = store.load();
    selectedIndex++;
    render();
  });

  screen.key(['K'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0 || selectedIndex <= 0) return;
    const task = tasks[selectedIndex];
    store.moveTask(db, task.id, 'up');
    db = store.load();
    selectedIndex--;
    render();
  });

  screen.key(['g'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    const branch = store.getCurrentBranch();
    if (branch) {
      store.linkBranch(db, task.id, branch);
      db = store.load();
      render();
    } else {
      promptInput('Branch name', (value) => {
        store.linkBranch(db, task.id, value);
        db = store.load();
      });
    }
  });

  // Filter cycling
  screen.key(['tab'], () => {
    const idx = FILTERS.indexOf(currentFilter);
    currentFilter = FILTERS[(idx + 1) % FILTERS.length];
    selectedIndex = 0;
    render();
  });

  screen.key(['S-tab'], () => {
    const idx = FILTERS.indexOf(currentFilter);
    currentFilter = FILTERS[(idx - 1 + FILTERS.length) % FILTERS.length];
    selectedIndex = 0;
    render();
  });

  // Add task
  screen.key(['a'], () => {
    if (inputBox.hidden === false) return;
    promptInput('New task', (value) => {
      store.addTask(db, value);
      db = store.load();
      currentFilter = 'all';
      tasks = store.getFilteredTasks(db, currentFilter);
      selectedIndex = tasks.length - 1;
    });
  });

  // Mark done
  screen.key(['d'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    store.setStatus(db, task.id, 'done');
    db = store.load();
    render();
  });

  // Block task
  screen.key(['b'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    if (task.status === 'blocked') return;
    promptInput('Block reason', (value) => {
      store.setStatus(db, task.id, 'blocked', value);
      db = store.load();
    });
  });

  // Reactivate
  screen.key(['r'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    if (task.status === 'active') return;
    store.setStatus(db, task.id, 'active');
    db = store.load();
    render();
  });

  // Edit task title
  screen.key(['e'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    promptInput('Edit title', (value) => {
      task.title = value;
      task.updatedAt = new Date().toISOString();
      store.save(db);
      db = store.load();
    });
  });

  // Cycle priority
  screen.key(['p'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    const cycle: TaskPriority[] = ['low', 'medium', 'high'];
    const idx = cycle.indexOf(task.priority ?? 'medium');
    const next = cycle[(idx + 1) % cycle.length];
    store.setPriority(db, task.id, next);
    db = store.load();
    render();
  });

  // Delete task (with confirmation)
  screen.key(['x'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    promptInput(`Delete "#${task.id} ${task.title}"? (y/n)`, (value) => {
      if (value.toLowerCase() === 'y' || value.toLowerCase() === 'yes') {
        store.deleteTask(db, task.id);
        db = store.load();
      }
    });
  });

  // Mouse support for task list
  taskList.on('click', function (_data: any) {
    // The click coordinates relative to the task list
    // Each task line is offset by 1 (the leading newline)
    const y = (screen as any).program?.y;
    if (y !== undefined) {
      const relativeY = y - Number(taskList.atop || 0) - 1; // subtract border
      const clickedIndex = relativeY - 1; // subtract the leading newline
      if (clickedIndex >= 0 && clickedIndex < tasks.length) {
        selectedIndex = clickedIndex;
        render();
      }
    }
  });

  // Quit
  screen.key(['q', 'C-c'], () => {
    saveSession();
    process.exit(0);
  });

  // Number keys for quick filter
  screen.key(['1'], () => { currentFilter = 'all'; selectedIndex = 0; render(); });
  screen.key(['2'], () => { currentFilter = 'active'; selectedIndex = 0; render(); });
  screen.key(['3'], () => { currentFilter = 'blocked'; selectedIndex = 0; render(); });
  screen.key(['4'], () => { currentFilter = 'done'; selectedIndex = 0; render(); });

  // Home / End
  screen.key(['home'], () => { selectedIndex = 0; render(); });
  screen.key(['end'], () => { selectedIndex = Math.max(0, tasks.length - 1); render(); });

  // Enter to focus/select current task as "working on"
  screen.key(['enter', 'return'], () => {
    if (inputBox.hidden === false) return;
    if (tasks.length === 0) return;
    const task = tasks[selectedIndex];
    db.session.lastActiveTaskId = task.id;
    store.save(db);
    render();
  });

  // Search
  screen.key(['/'], () => {
    if (inputBox.hidden === false) return;
    isSearching = true;
    promptInput('Search', (value) => {
      searchQuery = value;
      selectedIndex = 0;
      isSearching = false;
    });
  });

  screen.key(['escape'], () => {
    if (inputBox.hidden === false) return;
    if (searchQuery) {
      searchQuery = '';
      selectedIndex = 0;
      render();
    }
  });

  taskList.focus();
  render();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
