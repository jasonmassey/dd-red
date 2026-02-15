# DD Red — The Execution Engine

> Your backlog works while you sleep.

## What It Is

DD Red is an AI agent execution platform that turns a project backlog into a running pipeline. Instead of treating issues as passive descriptions waiting for a human, DD Red treats them as dispatchable units of work — analyzed, decomposed, and executed by AI agents in sandboxed environments.

## The Problem

Developers maintain backlogs of hundreds of issues. Most sit untouched. The bottleneck isn't knowing *what* to do — it's having enough hands to do it. AI coding agents exist, but they operate one-at-a-time, require manual prompting, and don't understand your project's context.

## The Insight

An issue isn't just a description. With the right metadata — complexity estimate, affected files, dependency ordering, pre-instructions — it becomes a machine-executable work order. DD Red adds that metadata automatically, then dispatches agents to execute it.

## Core Loop

```
Issue exists → Analyze complexity → Decompose into subtasks →
Generate pre-instructions → Dispatch agent(s) → Stream results →
Handle failures (retry with context) → PR lands → Close issue
```

## Key Capabilities

### 1. Task Intelligence
- AI-powered complexity analysis (small / medium / large)
- Automatic subtask decomposition with dependency graphs
- Pre-instruction generation (agent-specific guidance per task)
- Affected file and module identification

### 2. Agent Dispatch
- Sandboxed execution (E2B, Railway workers)
- Rich context injection: project memory, README, task list, conventions
- Parallel execution of independent subtasks (worktree runs)
- Priority queue with concurrency management

### 3. Failure Feedback Loop
- Structured failure analysis with categorization
- Artifact preservation from failed runs (diffs, logs, rescue branches)
- Retry with accumulated failure context — agents learn from prior attempts
- Escalation when retry budget is exhausted

### 4. Campaign Execution
- Parent task → child subtasks → parallel agent dispatch
- Dependency-aware sequencing (task B waits for task A)
- Progress tracking across the full campaign
- Single PR or per-subtask PRs with configurable merge strategy

## What DD Red Is NOT

- **Not a task tracker.** GitHub Issues / Linear / Jira own the source of truth. DD Red syncs from them.
- **Not an AI coding assistant.** Claude Code, Cursor, Copilot are for interactive coding. DD Red is for batch execution.
- **Not a CI/CD pipeline.** GitHub Actions runs tests. DD Red runs the work that produces the code being tested.

## Architecture (Shared Platform)

DD Red is a focused frontend on the dev-dash platform API. The server, database, agent infrastructure, and sync layer are shared across all DD products.

```
┌─────────────┐     ┌──────────────────────┐
│   DD Red    │────▶│   dev-dash server    │
│  (Vercel)   │     │    (Railway API)     │
└─────────────┘     └──────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               ┌────────┐ ┌──────┐ ┌────────┐
               │ SQLite │ │ E2B  │ │ GitHub │
               │   DB   │ │agents│ │  sync  │
               └────────┘ └──────┘ └────────┘
```

## Target User

A developer or small team with a real backlog (50+ issues) who wants to parallelize execution. They already use GitHub Issues. They want to point DD Red at their repo and watch agents chew through the queue.

## Success Metric

Issues closed per week without a human writing code.

## Implementation Priorities

1. **Campaign dashboard** — visualize parent→child decomposition and execution status
2. **Dispatch controls** — one-click "run this issue" and "run all ready children"
3. **Execution stream** — real-time agent output with failure highlighting
4. **Failure triage** — categorized failures with one-click retry
5. **Backlog scanner** — surface agent-suitable issues from your existing backlog
