/**
 * Timer Command Handler for Auto-Accept Countdown Feature
 * Fulfills: REQ-AC-CT-002 (Command-Based Timer Configuration)
 * ADR: ADR-003 (Dual Command Architecture)
 */

import { CountdownConfiguration, CountdownSettings } from './configuration-manager';

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * TimerCommandHandler Component
 * Responsibility: Process /timer and /countdown commands with validation
 * Trace: AC-AC-CT-002-01, AC-AC-CT-002-02, AC-AC-CT-002-03, AC-AC-CT-002-04, AC-AC-CT-002-05
 */
export class TimerCommandHandler {
  private configManager: CountdownConfiguration;

  constructor(configManager: CountdownConfiguration) {
    this.configManager = configManager;
  }

  /**
   * Handle /timer command
   * Fulfills: AC-AC-CT-002-01 - /timer 10 sets duration to 10 seconds
   * Fulfills: AC-AC-CT-002-03 - /timer without value displays current setting
   * Fulfills: AC-AC-CT-002-04 - /timer 0 enables immediate activation
   * Fulfills: AC-AC-CT-002-05 - /timer 65 shows error (max 60 seconds)
   */
  async handleTimerCommand(args: string[]): Promise<CommandResult> {
    try {
      // No arguments - show current setting
      if (args.length === 0) {
        return await this.showCurrentSetting();
      }

      // Parse and validate duration
      const validation = this.validateDuration(args[0]);
      if (!validation.valid) {
        return {
          success: false,
          message: `Timer error: ${validation.error}\n${await this.getCurrentSettingMessage()}`
        };
      }

      // Update configuration
      await this.configManager.updateDuration(validation.value!);

      // Return success message with appropriate context
      if (validation.value === 0) {
        return {
          success: true,
          message: "⚡ Auto-accept countdown disabled (immediate activation)\nAuto-accept will activate immediately when enabled with Shift+Tab"
        };
      } else {
        return {
          success: true,
          message: `⏳ Auto-accept countdown set to ${validation.value} seconds\nCountdown will display before each auto-accept when enabled`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Timer command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle /countdown command  
   * Fulfills: AC-AC-CT-002-02 - /countdown 5 sets duration to 5 seconds
   * Fulfills: AC-AC-CT-002-03 - /countdown without value displays current setting
   * 
   * Note: Identical behavior to /timer command for user preference accommodation
   */
  async handleCountdownCommand(args: string[]): Promise<CommandResult> {
    // Identical implementation to timer command as per ADR-003
    return await this.handleTimerCommand(args);
  }

  /**
   * Show current timer setting
   * Fulfills: AC-AC-CT-002-03 - Display current timer setting
   */
  async showCurrentSetting(): Promise<CommandResult> {
    try {
      const message = await this.getCurrentSettingMessage();
      return {
        success: true,
        message,
        data: this.configManager.getCurrentSettings()
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve current setting: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate duration parameter
   * Fulfills: AC-AC-CT-002-05 - Range validation (0-60 seconds)
   */
  validateDuration(input: string): ValidationResult {
    // Check for empty input
    if (!input || input.trim() === '') {
      return {
        valid: false,
        error: 'Duration value is required'
      };
    }

    // Parse as number
    const parsed = parseFloat(input.trim());

    // Check for NaN
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: 'Duration must be a number'
      };
    }

    // Check for integer
    if (!Number.isInteger(parsed)) {
      return {
        valid: false,
        error: 'Duration must be a whole number (no decimals)'
      };
    }

    const duration = Math.floor(parsed);

    // Range validation: 0-60 seconds
    if (duration < 0) {
      return {
        valid: false,
        error: 'Duration cannot be negative'
      };
    }

    if (duration > 60) {
      return {
        valid: false,
        error: 'Duration cannot exceed 60 seconds (maximum allowed)'
      };
    }

    return {
      valid: true,
      value: duration
    };
  }

  /**
   * Get formatted current setting message
   */
  private async getCurrentSettingMessage(): Promise<string> {
    const settings = this.configManager.getCurrentSettings();
    
    if (!settings.enabled) {
      return "🔧 Auto-accept countdown: DISABLED\nCountdown feature is turned off";
    }

    if (settings.duration === 0) {
      return "⚡ Auto-accept countdown: 0 seconds (immediate activation)\nAuto-accept activates immediately when enabled";
    }

    return `⏳ Auto-accept countdown: ${settings.duration} seconds\nCountdown displays before each auto-accept when enabled`;
  }

  /**
   * Register commands with Claude Code command system
   * This would integrate with the actual command registry
   */
  static registerCommands(): { timer: string; countdown: string } {
    return {
      timer: '/timer',
      countdown: '/countdown'
    };
  }

  /**
   * Get command help text for both commands
   */
  static getHelpText(): { timer: string; countdown: string } {
    const commonHelp = `
Usage:
  {command}           - Show current countdown setting
  {command} <seconds> - Set countdown duration (0-60 seconds)
  {command} 0         - Disable countdown (immediate auto-accept)
  {command} 5         - Set 5-second countdown (default)

Examples:
  {command}           → Shows: "⏳ Auto-accept countdown: 5 seconds"
  {command} 10        → Sets 10-second countdown
  {command} 0         → Immediate auto-accept (no countdown)
  
Range: 0-60 seconds (0 = immediate, 60 = maximum delay)
Note: Countdown only appears when auto-accept mode is active (Shift+Tab)`;

    return {
      timer: commonHelp.replace(/{command}/g, '/timer'),
      countdown: commonHelp.replace(/{command}/g, '/countdown')
    };
  }

  /**
   * Batch command processor for multiple timer operations
   * Useful for testing and advanced scenarios
   */
  async processBatchCommands(commands: Array<{ type: 'timer' | 'countdown'; args: string[] }>): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (const command of commands) {
      try {
        const result = command.type === 'timer' 
          ? await this.handleTimerCommand(command.args)
          : await this.handleCountdownCommand(command.args);
        
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Batch command failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return results;
  }
}

/**
 * Command Registration Helper
 * Utility for integrating with Claude Code's command system
 */
export class CountdownCommandRegistry {
  private handler: TimerCommandHandler;

  constructor(configManager: CountdownConfiguration) {
    this.handler = new TimerCommandHandler(configManager);
  }

  /**
   * Register both /timer and /countdown commands
   * This would integrate with the actual Claude Code command registry
   */
  registerAll(): void {
    // In real implementation, this would register with Claude Code's command system
    console.log('[CommandRegistry] Registering countdown commands...');
    
    // Register /timer command
    this.registerCommand('timer', (args: string[]) => this.handler.handleTimerCommand(args));
    
    // Register /countdown command  
    this.registerCommand('countdown', (args: string[]) => this.handler.handleCountdownCommand(args));
    
    console.log('[CommandRegistry] Countdown commands registered successfully');
  }

  private registerCommand(name: string, handler: (args: string[]) => Promise<CommandResult>): void {
    // Simulate command registration
    console.log(`[CommandRegistry] Registered command: /${name}`);
    
    // In real implementation:
    // claudeCode.commands.register(name, {
    //   handler: handler,
    //   description: TimerCommandHandler.getHelpText()[name as keyof ReturnType<typeof TimerCommandHandler.getHelpText>],
    //   category: 'Auto-Accept'
    // });
  }

  /**
   * Get the command handler for direct access
   */
  getHandler(): TimerCommandHandler {
    return this.handler;
  }
}