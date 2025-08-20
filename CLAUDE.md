# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **TimerCC** - a focused fork of Claude Code that adds auto-accept countdown functionality. This fork follows a **minimal fork strategy** to maintain easy upstream synchronization while providing enhanced safety features.

## Fork Strategy

**TimerCC** maintains a clean, minimal fork approach:
- **Focus**: Single feature enhancement (auto-accept countdown)
- **Upstream Compatibility**: Easy merging with claude-code upstream
- **Maintenance**: Minimal CI/CD overhead, production-ready code only

## Project Structure

- **.claude/commands/**: Essential commands (timer, countdown, utilities)
- **specs/auto-accept-countdown/**: Core feature implementation and specifications
- **specs/done/**: Archived completed features following Kiro convention

## Auto-Accept Countdown Feature

**Primary Enhancement**: Configurable safety countdown before auto-accept execution

### Key Commands

Available in `.claude/commands/`:

- **`/timer [duration]`**: Configure auto-accept countdown timer (0-60 seconds, default 5)
- **`/countdown [duration]`**: Alias for /timer command
- **`/commit-push-pr`**: Automated git workflow for commits, push, and PR creation  
- **`/dedupe`**: GitHub issue deduplication utilities

### Installation

**For Users:**
```sh
# Direct installation from repository
curl -O https://raw.githubusercontent.com/bizzkoot/TimerCC/main/specs/auto-accept-countdown/install.js
node install.js

# Or clone and install
git clone https://github.com/bizzkoot/TimerCC.git
cd TimerCC/specs/auto-accept-countdown/
node install.js
```

### Development Commands (Local Only)

For local development, additional Kiro workflow commands are available but not included in the repository to maintain minimal fork structure:

- Kiro specification-driven development commands (kept locally)
- Test files and build/verification scripts (kept locally)
- Full development documentation (kept locally)

## Technical Architecture

**Auto-Accept Countdown Implementation**:
- **Pattern**: Event interceptor pattern provides safety buffer before auto-accept execution
- **Configuration**: 0-60 seconds countdown (default 5s), persistent settings
- **UI**: Terminal status display with ESC cancellation support
- **Integration**: Non-intrusive design preserves existing Claude Code functionality

## Minimal Fork Principles

**Repository Contents** (Production Ready):
- Core feature implementation in TypeScript
- Essential command definitions
- Complete specifications and documentation
- Core installer script (install.js) for user installation

**Local Development** (Not in Repository):
- Comprehensive test suites
- Build and verification scripts  
- Kiro workflow development tools
- Development documentation

**Benefits of Minimal Fork Approach**:
1. **Easy Upstream Merging**: Minimal conflicts with claude-code updates
2. **Focused Maintenance**: Clear separation of production vs development code
3. **Reduced CI/CD Overhead**: No complex workflows or module dependency issues
4. **Clean Repository**: Professional, focused codebase for end users

## Archive Policy

Completed features are moved to `specs/done/` following Kiro convention:
- Maintains project history
- Keeps main workspace clean
- Preserves implementation knowledge

## Upstream Synchronization

To keep TimerCC fork up to date with the main claude-code repository:

**Steps to Sync with Upstream**:
1. **Fetch upstream changes**: `git fetch upstream`
2. **Check for new commits**: `git log --oneline upstream/main --not main`
3. **Merge upstream changes**: `git merge upstream/main`
4. **Push updated fork**: `git push origin main`

**Initial Setup** (one-time only):
```bash
git remote add upstream https://github.com/anthropics/claude-code.git
```

**Note**: The minimal fork strategy ensures clean merges with minimal conflicts.

## Development Guidelines

**For Local Development**:
1. Use full development environment with tests and Kiro tools
2. Keep comprehensive documentation and scripts locally
3. Test thoroughly before committing to repository

**For Repository Commits**:
1. Include only production-ready core implementation
2. Maintain backward compatibility with upstream Claude Code
3. Focus on the auto-accept countdown feature enhancement
4. Follow minimal fork strategy for easy maintenance
