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

### Development Commands (Local Only)

For local development, additional Kiro workflow commands are available but not included in the repository to maintain minimal fork structure:

- Kiro specification-driven development commands (kept locally)
- Test files and installation scripts (kept locally)
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

**Local Development** (Not in Repository):
- Comprehensive test suites
- Installation and build scripts  
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
