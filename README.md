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

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `j/k`, arrows | Navigate tasks |
| `Tab` / `Shift+Tab` | Cycle filters (all/active/blocked/done) |
| `1-4` | Jump to filter |
| `a` | Add task |
| `d` | Mark done |
| `b` | Block (with reason) |
| `r` | Reactivate |
| `e` | Edit title |
| `g` | Link current git branch |
| `x` | Delete task |
| `Enter` | Set as current focus |
| `q` | Quit |

### CLI Commands

```bash
focus add "implement auth flow"    # Add a task
focus done 1                       # Mark task #1 as done
focus block 2 "waiting on API"     # Block task with reason
focus activate 2                   # Reactivate a task
focus list                         # List active tasks
focus link 1                       # Link current git branch to task
```

## Storage

All data is stored locally in `~/.focus/db.json`. Session context (selected task, filter, last opened) persists across sessions.

## Design

- Single dependency (`blessed`) for the TUI
- Everything else uses Node.js builtins
- Automatic git branch detection
- Tokyo Night color scheme
