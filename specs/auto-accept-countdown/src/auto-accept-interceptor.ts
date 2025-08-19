import { CountdownTimer, CountdownState } from './countdown-timer';
import { StatusLineDisplay, TerminalStatusLineDisplay } from './status-line-display';
import { globalESCHandlerChain, ESCContext } from './esc-key-handler';
import { CountdownConfiguration, CountdownSettings } from './configuration-manager';

export interface AutoAcceptAction {
  id: string;
  type: 'file-edit' | 'command-execution' | 'file-creation' | 'file-deletion';
  description: string;
  execute: () => Promise<void>;
  metadata?: Record<string, any>;
}

export interface AutoAcceptInterceptor {
  interceptAction(action: AutoAcceptAction): Promise<boolean>;
  isCountdownActive(): boolean;
  cancelCurrentCountdown(): void;
  setCountdownDuration(seconds: number): void;
  getCountdownDuration(): number;
}

export class CountdownAutoAcceptInterceptor implements AutoAcceptInterceptor {
  private timer: CountdownTimer;
  private statusDisplay: StatusLineDisplay;
  private config: CountdownConfiguration;
  private currentAction: AutoAcceptAction | null = null;
  private countdownActive: boolean = false;

  constructor(
    timer: CountdownTimer,
    statusDisplay: StatusLineDisplay,
    config: CountdownConfiguration
  ) {
    this.timer = timer;
    this.statusDisplay = statusDisplay;
    this.config = config;
    
    this.setupTimerCallbacks();
    this.setupESCIntegration();
  }

  async interceptAction(action: AutoAcceptAction): Promise<boolean> {
    const settings = this.config.loadFromSettings();
    
    // If countdown is disabled or duration is 0, execute immediately
    if (!settings.enabled || settings.duration === 0) {
      this.statusDisplay.showImmediate();
      await this.executeAction(action);
      return true;
    }

    // Store current action and start countdown
    this.currentAction = action;
    this.countdownActive = true;
    
    try {
      const completed = await this.timer.start(settings.duration);
      
      if (completed) {
        // Countdown completed - execute action
        this.statusDisplay.showCompleted();
        await this.executeAction(action);
        return true;
      } else {
        // Countdown was cancelled
        this.statusDisplay.showCancelled();
        return false;
      }
    } catch (error) {
      console.error('Error during countdown:', error);
      this.statusDisplay.hide();
      this.countdownActive = false;
      this.currentAction = null;
      return false;
    } finally {
      this.countdownActive = false;
      this.currentAction = null;
    }
  }

  isCountdownActive(): boolean {
    return this.countdownActive;
  }

  cancelCurrentCountdown(): void {
    if (this.countdownActive) {
      this.timer.cancel();
      this.countdownActive = false;
      this.currentAction = null;
      this.statusDisplay.showCancelled();
    }
  }

  setCountdownDuration(seconds: number): void {
    if (seconds < 0 || seconds > 60) {
      throw new Error('Countdown duration must be between 0 and 60 seconds');
    }
    
    const settings = this.config.loadFromSettings();
    settings.duration = seconds;
    this.config.saveToSettings(settings);
  }

  getCountdownDuration(): number {
    return this.config.loadFromSettings().duration;
  }

  private async executeAction(action: AutoAcceptAction): Promise<void> {
    try {
      await action.execute();
    } catch (error) {
      console.error(`Failed to execute auto-accept action ${action.id}:`, error);
      throw error;
    }
  }

  private setupTimerCallbacks(): void {
    this.timer.onTick((remaining: number) => {
      if (this.countdownActive) {
        this.statusDisplay.showCountdown(remaining);
      }
    });

    this.timer.onComplete(() => {
      // Completion is handled in interceptAction method
    });

    this.timer.onCancel(() => {
      this.countdownActive = false;
      this.currentAction = null;
    });
  }

  private setupESCIntegration(): void {
    globalESCHandlerChain.setCountdownCancelCallback(() => {
      this.cancelCurrentCountdown();
    });
  }
}

// Integration with existing auto-accept system
export class AutoAcceptManager {
  private interceptor: AutoAcceptInterceptor;
  private autoAcceptEnabled: boolean = false;
  private originalAutoAcceptHandlers: Map<string, () => Promise<void>> = new Map();

  constructor(interceptor: AutoAcceptInterceptor) {
    this.interceptor = interceptor;
  }

  setAutoAcceptEnabled(enabled: boolean): void {
    this.autoAcceptEnabled = enabled;
  }

  isAutoAcceptEnabled(): boolean {
    return this.autoAcceptEnabled;
  }

  async processAutoAcceptAction(
    actionType: AutoAcceptAction['type'],
    description: string,
    executeFunction: () => Promise<void>,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    if (!this.autoAcceptEnabled) {
      return false; // Let manual acceptance handle this
    }

    const action: AutoAcceptAction = {
      id: `${actionType}-${Date.now()}`,
      type: actionType,
      description,
      execute: executeFunction,
      metadata
    };

    return await this.interceptor.interceptAction(action);
  }

  // Integration points for existing auto-accept functionality
  registerOriginalHandler(actionType: string, handler: () => Promise<void>): void {
    this.originalAutoAcceptHandlers.set(actionType, handler);
  }

  // Method to handle existing Shift+Tab toggle behavior
  toggleAutoAccept(): boolean {
    this.autoAcceptEnabled = !this.autoAcceptEnabled;
    
    if (this.autoAcceptEnabled) {
      const duration = this.interceptor.getCountdownDuration();
      console.log(`Auto-accept enabled with ${duration}s countdown (ESC to cancel individual actions)`);
    } else {
      console.log('Auto-accept disabled');
      
      // Cancel any active countdown when disabling auto-accept
      if (this.interceptor.isCountdownActive()) {
        this.interceptor.cancelCurrentCountdown();
      }
    }
    
    return this.autoAcceptEnabled;
  }

  // Get current ESC context for the handler chain
  getESCContext(): ESCContext {
    return {
      timestamp: Date.now(),
      activeCountdown: this.interceptor.isCountdownActive(),
      transcriptMode: false, // This would be set by transcript system
      oauthFlow: false, // This would be set by OAuth system
      autoAcceptEnabled: this.autoAcceptEnabled
    };
  }
}

// Factory function for easy setup
export function createAutoAcceptSystem(
  configPath?: string
): { interceptor: AutoAcceptInterceptor; manager: AutoAcceptManager } {
  const timer = new CountdownTimer();
  const statusDisplay = new TerminalStatusLineDisplay();
  const config = new CountdownConfiguration(configPath);
  
  const interceptor = new CountdownAutoAcceptInterceptor(timer, statusDisplay, config);
  const manager = new AutoAcceptManager(interceptor);
  
  return { interceptor, manager };
}

// Global instance for existing code integration
export const globalAutoAcceptSystem = createAutoAcceptSystem();
export const globalAutoAcceptManager = globalAutoAcceptSystem.manager;
export const globalAutoAcceptInterceptor = globalAutoAcceptSystem.interceptor;