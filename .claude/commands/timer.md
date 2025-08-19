---
description: Configure auto-accept countdown timer duration
---

## Context

Auto-accept countdown feature allows users to set a safety buffer before each automatic execution when auto-accept mode is enabled.

Current timer configuration: The timer is currently set to the default or previously configured duration.

## Command Usage

**Set timer duration:**
- `/timer 10` - Set countdown to 10 seconds  
- `/timer 0` - Disable countdown (immediate auto-accept)
- `/timer` - Show current timer setting

**Valid range:** 0-60 seconds
**Default:** 5 seconds

## Your task

Based on the user's command:

1. **If no duration provided (`/timer`)**: Display current timer setting
2. **If valid duration provided (0-60)**: 
   - Update the countdown duration setting
   - Save to persistent configuration
   - Confirm the new setting to user
3. **If invalid duration provided**:
   - Show error message with valid range (0-60 seconds)
   - Display current setting (no change)

**Implementation Notes:**
- Duration 0 means immediate auto-accept (no countdown)
- Duration 1-60 shows countdown before auto-accepting
- Setting only takes effect when auto-accept mode is enabled (Shift+Tab)
- Settings persist across Claude Code sessions
- Use the CountdownConfiguration class for settings management
- Provide clear feedback about the timer state and its effect on auto-accept behavior

**Example responses:**
- "Timer set to 10 seconds. Countdown will show before auto-accepting when auto-accept mode is enabled."
- "Timer set to 0 seconds. Auto-accept will be immediate when enabled."  
- "Current timer setting: 5 seconds"
- "Invalid duration: 65. Timer must be between 0-60 seconds. Current setting: 5 seconds"