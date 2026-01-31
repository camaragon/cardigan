# Agent Instructions

This project uses **OpenSpec** for planning and **Beads (bd)** for execution.

- **OpenSpec** = _What are we building and why?_ → specs, requirements, approval
- **Beads** = _Single source of truth for execution_ → all work tracking, dependencies, cross-session memory

## Session Start

```bash
bd ready                      # What's next?
bd list --status in_progress  # Anything mid-flight?
openspec list                 # Any changes pending approval?
```

`bd ready` is your north star. It always knows what to work on.

---

## Required Skills

**Always read and follow these skills when making or reviewing changes:**

1. **`.claude/skills/vercel-composition-patterns`** — Server/client component composition rules
2. **`.claude/skills/vercel-react-best-practices`** — React and Next.js best practices from Vercel Engineering
3. **`.claude/skills/web-design-guidelines`** — UI/UX and web design standards

Before implementing or reviewing any code change, read these skill files and apply their guidelines. They are mandatory, not optional.

---

## The Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PLANNING (OpenSpec)                         │
├─────────────────────────────────────────────────────────────────────┤
│  /opsx:explore  →  /opsx:new  →  /opsx:ff  →  Review & Approve     │
│                                                                     │
│  Output: proposal.md, specs/, design.md, tasks.md                   │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │   ONE-TIME CONVERSION        │
                    │   tasks.md → Beads issues    │
                    │   (epic + tasks + deps)      │
                    └──────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   EXECUTION (Beads is source of truth)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   bd ready → bd update → implement → bd close                       │
│                    │                                                │
│                    ↓                                                │
│            Discovered work?                                         │
│            bd create → bd dep add --type discovered-from            │
│                                                                     │
│   ⚠️  Do NOT update tasks.md checkboxes — Beads owns status         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         COMPLETION                                  │
├─────────────────────────────────────────────────────────────────────┤
│   All Beads tasks closed (including discovered)                     │
│                    ↓                                                │
│   /opsx:archive  →  bd sync  →  git push                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Planning (OpenSpec)

### When to Create a Change

- New features or capabilities
- Breaking changes (API, schema, behavior)
- Architecture changes
- Anything needing agreement before code

### Workflow

1. **Explore** (optional):

   ```
   /opsx:explore
   ```

   Investigate, think through options, clarify requirements.

2. **Create the change:**

   ```
   /opsx:new <change-name>
   ```

3. **Generate artifacts:**

   ```
   /opsx:ff                    # All at once (when scope is clear)
   /opsx:continue              # One at a time (when figuring it out)
   ```

4. **Review and get approval** before implementation.

### OpenSpec Commands

| Command          | Purpose                               |
| ---------------- | ------------------------------------- |
| `/opsx:explore`  | Investigate before committing         |
| `/opsx:new <n>`  | Start a new change                    |
| `/opsx:ff`       | Generate all planning artifacts       |
| `/opsx:continue` | Generate next artifact                |
| `/opsx:verify`   | Validate implementation matches specs |
| `/opsx:archive`  | Finalize and archive change           |

### CLI

```bash
openspec list                           # Active changes
openspec show <change>                  # View details
openspec status --change <n>            # Artifact status
openspec validate <change> --strict     # Validate formatting
```

---

## Phase 2: Conversion (One-Time)

When a change is approved and you're ready to implement, convert tasks.md to Beads **once**. This is the handoff from planning to execution.

### Conversion Steps

```bash
# 1. Create epic for the change
bd create "Epic: <change-name>" -t epic -p 1 -l "openspec:<change-name>"

# 2. Create tasks from tasks.md
#    Read tasks.md sections and create each task:
bd create "1.1: <task description>" -t task -p 2
bd create "1.2: <task description>" -t task -p 2
bd create "2.1: <task description>" -t task -p 2
# ... etc

# 3. Set up dependencies
#    Tasks block the epic:
bd dep add <epic-id> <task-1-id> --type blocks
bd dep add <epic-id> <task-2-id> --type blocks

#    If tasks have ordering dependencies:
bd dep add <task-2-id> <task-1-id> --type blocks  # task-2 waits for task-1
```

### Labels Convention

Tag all issues from a change for easy filtering:

```bash
bd create "..." -l "openspec:<change-name>"
```

Then you can list all work for a change:

```bash
bd list --label "openspec:<change-name>"
```

### After Conversion

**Beads is now the source of truth.** Do NOT update tasks.md checkboxes — all status lives in Beads.

---

## Phase 3: Execution (Beads)

### Working Through Tasks

```bash
bd ready                                # What's next? (respects dependencies)
bd update <id> --status in_progress     # Claim it
# ... implement ...
bd close <id> --reason "Completed"      # Done — next task unlocks
```

### Discovered Work

When you find bugs, TODOs, or follow-ups during implementation:

```bash
# Create and link to parent
bd create "Discovered: <description>" -t bug -p 2 -l "openspec:<change-name>"
bd dep add <new-id> <parent-task-id> --type discovered-from
```

This ensures:

- Discovered work is linked to what surfaced it
- `bd ready` shows it when appropriate
- Nothing gets lost between sessions

### Resuming Work (New Session / New Agent)

```bash
bd ready                                # Immediately know what's next
bd show <id>                            # Full context on the task
bd list --label "openspec:<change-name>" --status open   # All remaining work for change
```

The dependency graph ensures tasks surface in the right order, and `discovered-from` links provide context on why something exists.

### Beads Commands

```bash
bd ready                                # Work with no blockers
bd ready --priority 1                   # Filter by priority
bd list --status open                   # All open issues
bd list --label <label>                 # Filter by label
bd show <id>                            # Full details
bd create "<title>" -t <type> -p <pri>  # Create issue
bd update <id> --status in_progress     # Claim work
bd close <id> --reason "<reason>"       # Complete work
bd dep add <a> <b> --type <type>        # Add dependency
bd dep tree <id>                        # Visualize dependencies
bd sync                                 # Sync with git
```

**Types:** `epic`, `feature`, `task`, `bug`, `chore`  
**Priorities:** `0` (critical) → `4` (low)  
**Dependencies:** `blocks`, `parent-child`, `related`, `discovered-from`

---

## Phase 4: Completion

When all Beads tasks for a change are closed:

```bash
# 1. Verify nothing remains
bd list --label "openspec:<change-name>" --status open
# Should be empty

# 2. Verify implementation matches specs
/opsx:verify

# 3. Archive the OpenSpec change (merges delta specs)
/opsx:archive

# 4. Sync and push
bd sync
git add -A && git commit -m "Complete <change-name>"
git push
```

---

## Small Work (No OpenSpec)

For bugs, small tasks, or chores that don't need spec alignment — skip OpenSpec entirely:

```bash
bd create "Fix: login redirect loop" -t bug -p 1
bd update <id> --status in_progress
# ... fix ...
bd close <id> --reason "Fixed"
bd sync && git push
```

---

## Landing the Plane (Session End)

**Work is NOT complete until `git push` succeeds.**

### Checklist

1. **File remaining work**

   ```bash
   bd create "TODO: <description>" -t task -p 2
   ```

2. **Quality gates** (if code changed)
   - Run tests, linters, builds
   - If broken: `bd create "BROKEN: <issue>" -t bug -p 0`

3. **Update Beads**

   ```bash
   bd close <id> --reason "..."          # Finished
   bd update <id> --status in_progress   # Partial (add notes via description)
   ```

4. **Archive completed changes**

   ```
   /opsx:archive
   ```

5. **Push**

   ```bash
   git pull --rebase
   bd sync
   git add -A && git commit -m "Session update"
   git push
   git status  # Must show "up to date"
   ```

6. **Verify**

   ```bash
   bd ready        # Shows accurate next work
   ```

7. **Hand off** — context for next session

### Rules

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing
- NEVER say "ready to push when you are" — YOU push
- If push fails, resolve and retry

---

## Quick Reference

| I need to...              | Do this                                                   |
| ------------------------- | --------------------------------------------------------- |
| Start my session          | `bd ready`                                                |
| Plan a new feature        | `/opsx:new` → `/opsx:ff` → approve → convert to Beads     |
| See what's next           | `bd ready`                                                |
| Work on a task            | `bd update --status in_progress` → implement → `bd close` |
| Log discovered work       | `bd create -t bug` + `bd dep add --type discovered-from`  |
| See all work for a change | `bd list --label "openspec:<change>"`                     |
| Resume after interruption | `bd ready` (dependencies handle ordering)                 |
| Finish a change           | All tasks closed → `/opsx:archive`                        |
| End session               | `bd sync` → `git push`                                    |
