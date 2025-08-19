# Design: Auto-Accept Countdown - Architect Agent

## Requirements Context Summary
Feature UUID: FEAT-AC-CT-2024 | Stakeholders: [Development Teams (Primary), Individual Developers (Secondary), Team Leads (Tertiary)] | Priority: [P0 Safety Features, P1 Configuration, P2 Persistence]

## ADRs (Architectural Decision Records)

### ADR-001: Event-Driven Countdown Integration with Existing Auto-Accept System
Status: Proposed | Context: [Claude Code already has Shift+Tab auto-accept toggle, ESC cancellation patterns, timeout infrastructure from hooks/MCP]
Decision: **Integrate countdown timer as an interceptor in the auto-accept workflow rather than replacing existing system** | Rationale: [Maintains backward compatibility, leverages existing ESC handling, preserves Shift+Tab behavior]
Requirements: REQ-AC-CT-001, REQ-AC-CT-004 | Confidence: 95%
Alternatives: [Replace auto-accept system (rejected: breaking change), Separate countdown mode (rejected: UX complexity)]
Impact: [Zero performance impact on manual mode, <1ms overhead per countdown update, maintains all existing keyboard shortcuts]

### ADR-002: Bottom-Left Status Display Architecture
Status: Proposed | Context: [Requirements specify bottom section, outside dialog box, left side placement for countdown display]
Decision: **Create new StatusLine component that renders below main Claude interface, similar to terminal status bars** | Rationale: [Non-intrusive placement, follows terminal UX patterns, separate from main conversation flow]
Requirements: REQ-AC-CT-003, NFR-AC-CT-UX-001 | Confidence: 88%
Alternatives: [Inline countdown in dialog (rejected: visual clutter), Overlay modal (rejected: blocks interaction)]
Impact: [Requires new UI component, minimal terminal space usage, consistent with existing status indicators]

### ADR-003: Dual Command Architecture (/timer + /countdown)
Status: Proposed | Context: [Requirements specify both `/timer` and `/countdown` commands for different user mental models]
Decision: **Implement unified command handler with dual entry points mapping to same configuration backend** | Rationale: [Accommodates different user preferences, maintains consistency, shared validation logic]
Requirements: REQ-AC-CT-002 | Confidence: 97%
Alternatives: [Single command only (rejected: reduces UX flexibility), Separate implementations (rejected: code duplication)]
Impact: [Slight increase in command namespace, unified configuration handling, consistent behavior across commands]

### ADR-004: Settings Integration with .claude/settings.json Schema
Status: Proposed | Context: [Claude Code uses .claude/settings.json for configuration, must maintain backward compatibility]
Decision: **Extend settings schema with autoAcceptCountdown object containing duration and enabled fields** | Rationale: [Follows existing patterns, namespace separation, validation consistency]
Requirements: REQ-AC-CT-005, NFR-AC-CT-COMPAT-001 | Confidence: 99%
Alternatives: [Separate config file (rejected: inconsistent), Environment variables only (rejected: poor UX)]
Impact: [Zero breaking changes, consistent with existing configuration patterns, supports validation]

### ADR-005: Node.js setTimeout-Based Timer Implementation
Status: Proposed | Context: [Claude Code built on Node.js runtime, requires 100ms precision, must be cancellable]
Decision: **Use Node.js setTimeout with 100ms intervals for countdown updates, clearTimeout for cancellation** | Rationale: [Native Node.js capability, precise timing control, standard cancellation pattern]
Requirements: NFR-AC-CT-PERF-001, REQ-AC-CT-004 | Confidence: 93%
Alternatives: [setInterval (rejected: harder cancellation), Date polling (rejected: performance), Web Workers (rejected: overkill)]
Impact: [Minimal CPU usage, standard JavaScript patterns, reliable cancellation]

### ADR-006: Emoji-Based Visual Indicators with Terminal Compatibility
Status: Proposed | Context: [Need accessible visual indicators that work across different terminal environments]
Decision: **Use Unicode emoji (⏳⚡❌✅) with fallback ASCII alternatives for terminals without emoji support** | Rationale: [Universal recognition, accessibility-friendly, minimal visual space, cross-platform compatibility]
Requirements: REQ-AC-CT-003, NFR-AC-CT-UX-001 | Confidence: 91%
Alternatives: [ASCII-only symbols (rejected: less intuitive), Color-only indicators (rejected: accessibility issues), Text-only (rejected: visual clutter)]
Impact: [Enhanced user experience, potential emoji compatibility checks needed, graceful fallback to ASCII]

## Architecture Patterns
Primary: **Event Interceptor Pattern** → Addresses: REQ-AC-CT-001 (Intercepts auto-accept events to inject countdown)
Secondary: **Command Pattern** → Addresses: REQ-AC-CT-002 (Unified command handling for /timer and /countdown)
Tertiary: **Observer Pattern** → Addresses: REQ-AC-CT-003 (UI updates during countdown state changes)

## Components

### Modified: Auto-Accept System → Fulfills: AC-AC-CT-001-01, AC-AC-CT-001-03
Current State: [Shift+Tab toggle enables immediate auto-accept for file edits] 
Changes: [Add countdown interceptor before auto-accept execution, preserve existing toggle behavior]
Impact Analysis: [No changes to Shift+Tab behavior, countdown only active when configured] 
Migration Strategy: [Gradual rollout with feature flag, default disabled for backward compatibility]

### Modified: ESC Key Handler → Fulfills: AC-AC-CT-004-01, AC-AC-CT-004-03
Current State: [ESC cancels current operations, exits transcript mode, cancels OAuth flows]
Changes: [Add countdown cancellation to existing ESC handler chain, maintain existing behaviors]
Impact Analysis: [Extends existing ESC functionality without conflicts] 
Migration Strategy: [Priority-based handler chain with countdown cancellation as high priority]

### New: CountdownTimer Component → Responsibility: {Core countdown logic and state management}
Interface:
```typescript
interface CountdownTimer {
  start(duration: number): Promise<boolean> // AC-AC-CT-001-01 - Returns true if completed, false if cancelled
  cancel(): void                            // AC-AC-CT-004-01 - Immediate cancellation
  getCurrentState(): CountdownState         // AC-AC-CT-003-01 - For UI updates
  onTick(callback: (remaining: number) => void): void // AC-AC-CT-003-01 - 1-second precision updates
  onComplete(callback: () => void): void    // AC-AC-CT-001-03 - Auto-accept execution
  onCancel(callback: () => void): void      // AC-AC-CT-004-02 - Manual acceptance fallback
}

enum CountdownState {
  IDLE = "idle",
  RUNNING = "running", 
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}
```

### New: StatusLineDisplay Component → Responsibility: {Visual countdown feedback in bottom-left terminal area}
Interface:
```typescript
interface StatusLineDisplay {
  showCountdown(remaining: number): void    // AC-AC-CT-003-01 - Display "⏳ Auto-accept in 5s (ESC to cancel)"
  showImmediate(): void                     // AC-AC-CT-002-04 - Display "⚡ Auto-accept enabled (immediate)"
  showCancelled(): void                     // AC-AC-CT-003-03 - Display "❌ Auto-accept cancelled"
  showCompleted(): void                     // AC-AC-CT-003-02 - Display "✅ Auto-accepting..."
  hide(): void                              // Clear status display
  isVisible(): boolean                      // Current visibility state
  handleResize(): void                      // Terminal resize event handler
}
```

### New: TimerCommandHandler Component → Responsibility: {Process /timer and /countdown commands with validation}
Interface:
```typescript
interface TimerCommandHandler {
  handleTimerCommand(args: string[]): Promise<CommandResult>     // AC-AC-CT-002-01, AC-AC-CT-002-04
  handleCountdownCommand(args: string[]): Promise<CommandResult> // AC-AC-CT-002-02
  showCurrentSetting(): Promise<CommandResult>                  // AC-AC-CT-002-03
  validateDuration(duration: number): ValidationResult          // AC-AC-CT-002-05 - Range validation
}
```

### New: CountdownConfiguration Component → Responsibility: {Settings persistence and validation}
Interface:
```typescript
interface CountdownConfiguration {
  loadFromSettings(): CountdownSettings    // AC-AC-CT-005-01 - Load from .claude/settings.json
  saveToSettings(settings: CountdownSettings): void // AC-AC-CT-005-02 - Persist settings
  getDefaultSettings(): CountdownSettings  // AC-AC-CT-005-03 - Fallback defaults
  validateSettings(settings: any): boolean // Schema validation
}

interface CountdownSettings {
  duration: number;        // 0-60 seconds, default 5
  enabled: boolean;        // Feature toggle, default true
  version: string;         // Schema version for migrations
}
```

## Command Matrix
| Command | Arguments | Requirements | Validation | Error Handling |
|---------|-----------|-------------|------------|----------------|
| `/timer` | `[duration?]` | AC-AC-CT-002-01,03 | 0-60 range, integer | Invalid input shows current setting |
| `/countdown` | `[duration?]` | AC-AC-CT-002-02,03 | 0-60 range, integer | Invalid input shows current setting |
| `/timer 0` | `[0]` | AC-AC-CT-002-04 | Immediate activation | No countdown display |
| `/timer 65` | `[65]` | AC-AC-CT-002-05 | Range exceeded | Error message, no change |

## Configuration Schema + Traceability
```json
// Supports: REQ-AC-CT-005 - Persistent Configuration Storage
{
  "autoAcceptCountdown": {
    "duration": 5,           // AC-AC-CT-005-01 - Default 5 seconds
    "enabled": true,         // AC-AC-CT-005-02 - Feature toggle
    "version": "1.0"         // AC-AC-CT-005-03 - Schema versioning
  }
}
```

## State Flow Diagram + Traceability
```
[Manual Mode] ──Shift+Tab──► [Auto-Accept Mode]
      │                           │
      │                           ▼
      │                    [Check Countdown Config]
      │                           │
      │                    ┌─────────┴──────────┐
      │                    ▼                    ▼
      │              [Duration > 0]      [Duration = 0]
      │                    │                    │
      │                    ▼                    ▼
      │              [Start Countdown]    [Immediate Accept] ◄── AC-AC-CT-002-04
      │                    │
      │              ┌─────────┴──────────┐
      │              ▼                    ▼
      │         [ESC Pressed]        [Countdown Complete]
      │              │                    │
      │              ▼                    ▼
      │         [Cancel Timer]      [Execute Auto-Accept] ◄── AC-AC-CT-001-03
      │              │                    │
      │              ▼                    ▼
      └─────── [Manual Accept] ◄── AC-AC-CT-004-02  [Continue Auto-Accept Mode]
                     │
                     ▼
               [User Decision Required]
```

## Integration Points + Traceability

### 1. Auto-Accept Workflow Integration
- **Location**: Core auto-accept handler (before execution)
- **Modification**: Add countdown interceptor
- **Requirements**: REQ-AC-CT-001 (Configurable Auto-Accept Countdown)

### 2. ESC Key Handler Chain
- **Location**: Global keyboard event handler
- **Modification**: Add countdown cancellation handler (high priority)
- **Requirements**: REQ-AC-CT-004 (Countdown Cancellation Control)

### 3. Command Registry
- **Location**: `.claude/commands/` directory
- **Addition**: Create `timer.md` and `countdown.md` command definitions
- **Requirements**: REQ-AC-CT-002 (Command-Based Timer Configuration)

### 4. Settings Schema
- **Location**: `.claude/settings.json` validation schema
- **Extension**: Add `autoAcceptCountdown` object with validation rules
- **Requirements**: REQ-AC-CT-005 (Persistent Configuration Storage)

### 5. Status Display System
- **Location**: Terminal UI rendering pipeline
- **Addition**: Bottom-left status line component
- **Requirements**: REQ-AC-CT-003 (Visual Countdown Feedback)

## Quality Gates
- **ADRs**: >95% confidence to requirements (all ADRs exceed 88% confidence threshold)
- **Interfaces**: 100% traceability to acceptance criteria (all methods mapped to specific AC IDs)
- **NFRs**: Measurable validation strategy defined for each non-functional requirement
- **Security**: No privilege escalation, maintains existing permission system isolation
- **Performance**: <1ms overhead per countdown update, 100ms precision maintained

## Architecture Context Transfer

**Key Decisions**: 
- **Event Interceptor Pattern**: Chosen for seamless integration with existing auto-accept system without breaking changes
- **Dual Command Support**: Both `/timer` and `/countdown` supported for different user mental models  
- **Bottom-Left Status Display**: Non-intrusive placement following terminal UI conventions
- **Settings Integration**: Extends existing `.claude/settings.json` schema for consistency
- **Node.js setTimeout**: Leverages native timing capabilities for reliable countdown implementation

**Implementation Decisions Resolved**:
- **Visual Indicators**: Use simple, accessible emoji/symbols for countdown display:
  - ⏳ (hourglass) for active countdown
  - ⚡ (lightning) for immediate auto-accept (0 seconds)
  - ❌ (X) for cancelled countdown
  - ✅ (checkmark) for completed countdown
- **Terminal Resize Handling**: Use relative positioning and dynamic width calculation to maintain bottom-left placement without breaking layout
- **Audio Feedback**: None required - purely visual countdown indication
- **System Sleep/Wake Cycles**: Inherit existing Claude Code behavior patterns - if Claude continues auto-accept through sleep/wake, countdown will maintain same behavior

**Context Compression for Implementation Phase**:
- **Core Architecture**: Event interceptor pattern with existing auto-accept workflow integration
- **UI Strategy**: Bottom-left status line with 1-second precision updates and ESC cancellation
- **Configuration**: Extends `.claude/settings.json` with autoAcceptCountdown object (duration: 0-60, default: 5)
- **Commands**: Dual entry points (`/timer`, `/countdown`) with unified backend and range validation
- **Integration Points**: 5 specific modification points identified with backward compatibility maintained