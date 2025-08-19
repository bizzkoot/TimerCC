# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Claude Code repository - an agentic coding tool for terminal-based development assistance. The project adopts Kiro-style specification-driven development for systematic feature development.

## Project Structure

- **.claude/commands/**: Custom Claude Code commands including Kiro workflow commands
- **scripts/**: Utility scripts for GitHub automation and maintenance
- **examples/**: Example configurations including hooks for bash command validation
- **specs/**: Feature specifications directory (created during Kiro workflow)

## Development Commands

This repository doesn't contain traditional build/test commands as it's primarily a documentation and workflow template repository. Key operations include:

- **Git operations**: Standard git commands for version control
- **GitHub CLI**: `gh` commands for PR and issue management via `/commit-push-pr` command
- **Script execution**: TypeScript scripts in `/scripts` can be run with `bun` or appropriate runtime

## Custom Commands

Available in `.claude/commands/`:

- **`/kiro [feature-name]`**: Full Traceable Agentic Development workflow
- **`/kiro-researcher [feature-name]`**: Requirements specialist (Phase 1)
- **`/kiro-architect [feature-name]`**: Design specialist (Phase 2) 
- **`/kiro-implementer [feature-name]`**: Implementation specialist (Phase 3)
- **`/commit-push-pr`**: Automated git workflow for commits, push, and PR creation
- **`/dedupe`**: GitHub issue deduplication utilities
- **`/timer [duration]`**: Configure auto-accept countdown timer (0-60 seconds, default 5)
- **`/countdown [duration]`**: Alias for /timer command

## Architecture Notes

- **Traceable Agentic Development (TAD)**: All specifications include semantic traceability chains linking requirements → design → tasks → implementation
- **UUID-based tracking**: Each requirement, acceptance criteria, and task gets a unique identifier for cross-reference
- **Confidence scoring**: AI-generated confidence scores for requirements-to-design and design-to-task mappings
- **Auto-verification**: Built-in validation checks for forward/backward traceability across all specification files
- **Auto-Accept Countdown**: Event interceptor pattern provides safety buffer before auto-accept execution (configurable 0-60s, ESC cancellation, terminal status display)

## Kiro Workflow System

## Specification Files

- **specs/{feature-name}/requirements.md**: User stories and acceptance criteria
- **specs/{feature-name}/design.md**: Technical architecture and components
- **specs/{feature-name}/tasks.md**: Implementation tasks and progress tracking

## Development Flow

1. Requirements Definition → Document in requirements.md
2. Design → Document in design.md
3. Task Division → Document in tasks.md
4. Implementation → Implement each task sequentially
5. Verification → Test build and resolve any errors
6. Archival → Move completed features to specs/done/

## Commands

- `/kiro`: Initialize specifications for a new feature
- Ask "Approve requirements.md" to confirm requirements
- Ask "Approve design.md" to confirm design
- Ask "Please implement Task X" for implementation

## Development Rules

1. All features start with requirements definition
2. Proceed to design after approving requirements
3. Proceed to implementation after approving design
4. Tasks should be independently testable
5. Mark tasks as completed using `[x]` notation
6. All tasks must pass verification before archiving

## Task Completion

When a task is completed:
1. Update tasks.md by changing `[ ]` to `[x]`
2. Update the progress counter at the top of tasks.md
3. Proceed to the next task only after confirming current task works

## Agent Specialization

This project supports specialized agent roles for different phases of development:

### Agent Commands
- `/kiro [feature-name]` - Full workflow (all phases)
- `/kiro-researcher [feature-name]` - Requirements specialist
- `/kiro-architect [feature-name]` - Design specialist
- `/kiro-implementer [feature-name]` - Implementation specialist

### Agent Workflow
1. Start with `/kiro-researcher [feature-name]` to create requirements.md
2. After approval, continue with `/kiro-architect [feature-name]` to create design.md
3. After approval, finish with `/kiro-implementer [feature-name]` to create tasks.md and implement

### Benefits
- More thorough analysis at each phase
- Optimized context utilization
- Better preservation of implementation details
- Enhanced specialization for complex features

## Responding to Specification Changes

When specifications change, update all related specification files (requirements.md, design.md, tasks.md) while maintaining consistency.

Examples:
- "I want to add user authentication functionality"
- "I want to change the database from PostgreSQL to MongoDB"
- "The dark mode feature is no longer needed, please remove it"

When changes occur, take the following actions:

1. Add/modify/delete requirements in requirements.md
2. Update design.md to match the requirements
3. Adjust tasks.md based on the design
4. Verify consistency between all files
