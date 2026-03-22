# focus

A context-aware task brain for solo engineers. Terminal UI similar to lazygit — navigate with keyboard or mouse.

![TypeScript](https://img.shields.io/badge/TypeScript-blue) ![Minimal Dependencies](https://img.shields.io/badge/deps-1-green)

## Install

```bash
git clone git@github.com:zaguezzar/focus.git
cd focus
npm install
npm run build
npm link
```

## Usage

### Interactive UI

```bash
focus
```

Opens a two-pane TUI with task list and detail panel.

**Navigation:**

| Key | Action |
|-----|--------|
| `j/k`, arrows | Navigate tasks |
| `J/K` | Reorder tasks |
| `Tab` / `Shift+Tab` | Cycle filters |
| `1-5` | Jump to filter (all/active/blocked/done/archive) |
| `/` | Search tasks |
| `Esc` | Clear search |
| `Enter` | Set as current focus |
| `q` | Quit |

**Task actions:**

| Key | Action |
|-----|--------|
| `a` | Add task |
| `d` | Mark done |
| `b` | Block (with reason) |
| `r` | Reactivate |
| `e` | Edit title |
| `p` | Cycle priority (low/medium/high) |
| `s` | Add subtask |
| `n` | Add note |
| `#` | Add/remove tag (prefix `-` to remove) |
| `x` | Delete (with confirmation) |

**Git integration:**

| Key | Action |
|-----|--------|
| `c` | Create & checkout branch from task |
| `g` | Link current branch to task |

**Pomodoro timer:**

| Key | Action |
|-----|--------|
| `t` | Start/pause timer |
| `T` | Reset timer |
| `w` | Toggle timer panel |
| `+`/`-` | Adjust duration (5-120 min) |

### CLI Commands

```bash
focus add "implement auth flow"    # Add a task
focus done 1                       # Mark task #1 as done
focus block 2 "waiting on API"     # Block task with reason
focus activate 2                   # Reactivate a task
focus list                         # List active tasks
focus link 1                       # Link current git branch to task
focus now                          # Show current focused task
focus pick                         # Suggest a random active task
focus prompt                       # Minimal output for shell PS1
```

### Shell prompt integration

Add to your `.zshrc` or `.bashrc`:

```bash
export PS1="$(focus prompt) $PS1"
```

## Storage

All data is stored locally in `~/.focus/db.json`. Session context (selected task, filter, timer state) persists across sessions.

## Design

- Single dependency (`blessed`) for the TUI
- Everything else uses Node.js builtins
- Automatic git branch detection and task linking
- Tokyo Night color scheme
