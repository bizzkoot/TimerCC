/**
 * Core Countdown Timer Component for Auto-Accept Countdown Feature
 * Fulfills: REQ-AC-CT-001 (Configurable Auto-Accept Countdown), REQ-AC-CT-004 (Countdown Cancellation Control)
 * ADR: ADR-005 (Node.js setTimeout-Based Timer Implementation)
 */

export enum CountdownState {
  IDLE = "idle",
  RUNNING = "running",
  COMPLETED = "completed",
  CANCELLED = "cancelled"
}

export interface CountdownEventCallbacks {
  onTick?: (remaining: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onStateChange?: (newState: CountdownState, oldState: CountdownState) => void;
}

/**
 * CountdownTimer Component
 * Responsibility: Core countdown logic and state management
 * Trace: AC-AC-CT-001-01, AC-AC-CT-001-02, AC-AC-CT-001-03, AC-AC-CT-004-01, AC-AC-CT-004-02
 */
export class CountdownTimer {
  private state: CountdownState = CountdownState.IDLE;
  private duration: number = 0;
  private remaining: number = 0;
  private startTime: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private callbacks: CountdownEventCallbacks = {};

  constructor(callbacks?: CountdownEventCallbacks) {
    this.callbacks = callbacks || {};
  }

  /**
   * Start countdown timer
   * Fulfills: AC-AC-CT-001-01 - System shows countdown before auto-accepting
   * Returns: Promise<boolean> - true if completed, false if cancelled
   */
  async start(duration: number): Promise<boolean> {
    return new Promise((resolve) => {
      // Validate duration
      if (duration < 0 || duration > 60 || !Number.isInteger(duration)) {
        throw new Error(`Invalid duration: ${duration}. Must be integer between 0 and 60.`);
      }

      // Handle immediate completion (0 seconds)
      if (duration === 0) {
        this.setState(CountdownState.COMPLETED);
        this.callbacks.onComplete?.();
        resolve(true);
        return;
      }

      // Stop any existing timer
      this.stop();

      // Initialize timer state
      this.duration = duration;
      this.remaining = duration;
      this.startTime = Date.now();
      
      this.setState(CountdownState.RUNNING);

      // Start tick interval for UI updates (100ms precision as per NFR-AC-CT-PERF-001)
      this.intervalId = setInterval(() => {
        this.updateRemaining();
        
        if (this.remaining <= 0) {
          this.complete();
          resolve(true);
        }
      }, 100);

      // Set completion timeout as backup
      this.timeoutId = setTimeout(() => {
        if (this.state === CountdownState.RUNNING) {
          this.complete();
          resolve(true);
        }
      }, duration * 1000);

      // Store resolve function for cancellation
      (this as any).resolvePromise = resolve;
    });
  }

  /**
   * Cancel countdown timer immediately
   * Fulfills: AC-AC-CT-004-01 - ESC stops countdown immediately
   * Fulfills: AC-AC-CT-004-02 - System returns to manual acceptance mode
   */
  cancel(): void {
    if (this.state !== CountdownState.RUNNING) {
      return; // Already stopped or not running
    }

    this.stop();
    this.setState(CountdownState.CANCELLED);
    this.callbacks.onCancel?.();

    // Resolve the start promise with false (cancelled)
    const resolve = (this as any).resolvePromise;
    if (resolve) {
      resolve(false);
      delete (this as any).resolvePromise;
    }
  }

  /**
   * Get current countdown state
   * Fulfills: AC-AC-CT-003-01 - For UI updates
   */
  getCurrentState(): CountdownState {
    return this.state;
  }

  /**
   * Get remaining time in seconds
   */
  getRemainingTime(): number {
    return Math.max(0, Math.ceil(this.remaining));
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    if (this.state === CountdownState.IDLE) {
      return 0;
    }
    return Math.max(0, this.duration - this.remaining);
  }

  /**
   * Get total duration
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * Check if timer is currently running
   */
  isRunning(): boolean {
    return this.state === CountdownState.RUNNING;
  }

  /**
   * Check if timer was cancelled
   */
  wasCancelled(): boolean {
    return this.state === CountdownState.CANCELLED;
  }

  /**
   * Check if timer completed successfully
   */
  wasCompleted(): boolean {
    return this.state === CountdownState.COMPLETED;
  }

  /**
   * Register event callbacks
   */
  onTick(callback: (remaining: number) => void): void {
    this.callbacks.onTick = callback;
  }

  onComplete(callback: () => void): void {
    this.callbacks.onComplete = callback;
  }

  onCancel(callback: () => void): void {
    this.callbacks.onCancel = callback;
  }

  onStateChange(callback: (newState: CountdownState, oldState: CountdownState) => void): void {
    this.callbacks.onStateChange = callback;
  }

  /**
   * Reset timer to idle state
   */
  reset(): void {
    this.stop();
    this.setState(CountdownState.IDLE);
    this.duration = 0;
    this.remaining = 0;
    this.startTime = 0;
  }

  /**
   * Dispose of timer and cleanup resources
   */
  dispose(): void {
    this.stop();
    this.callbacks = {};
    delete (this as any).resolvePromise;
  }

  // Private methods

  private stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private complete(): void {
    this.stop();
    this.remaining = 0;
    this.setState(CountdownState.COMPLETED);
    this.callbacks.onComplete?.();
  }

  private updateRemaining(): void {
    if (this.state !== CountdownState.RUNNING) {
      return;
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    const newRemaining = Math.max(0, this.duration - elapsed);
    
    // Only trigger onTick if remaining seconds changed (for 1-second precision display)
    if (Math.ceil(newRemaining) !== Math.ceil(this.remaining)) {
      this.callbacks.onTick?..(Math.ceil(newRemaining));
    }
    
    this.remaining = newRemaining;
  }

  private setState(newState: CountdownState): void {
    const oldState = this.state;
    if (oldState !== newState) {
      this.state = newState;
      this.callbacks.onStateChange?.(newState, oldState);
    }
  }
}

/**
 * CountdownTimerManager
 * Singleton manager for global countdown timer instance
 * Ensures only one countdown can run at a time
 */
export class CountdownTimerManager {
  private static instance: CountdownTimerManager;
  private currentTimer: CountdownTimer | null = null;

  private constructor() {}

  static getInstance(): CountdownTimerManager {
    if (!CountdownTimerManager.instance) {
      CountdownTimerManager.instance = new CountdownTimerManager();
    }
    return CountdownTimerManager.instance;
  }

  /**
   * Start a new countdown, cancelling any existing one
   */
  async startCountdown(duration: number, callbacks?: CountdownEventCallbacks): Promise<boolean> {
    // Cancel existing countdown
    if (this.currentTimer?.isRunning()) {
      this.currentTimer.cancel();
    }

    // Create new timer
    this.currentTimer = new CountdownTimer(callbacks);
    
    try {
      const completed = await this.currentTimer.start(duration);
      return completed;
    } catch (error) {
      this.currentTimer = null;
      throw error;
    }
  }

  /**
   * Cancel current countdown
   */
  cancelCountdown(): void {
    if (this.currentTimer?.isRunning()) {
      this.currentTimer.cancel();
    }
  }

  /**
   * Get current timer instance
   */
  getCurrentTimer(): CountdownTimer | null {
    return this.currentTimer;
  }

  /**
   * Check if countdown is currently running
   */
  isCountdownRunning(): boolean {
    return this.currentTimer?.isRunning() ?? false;
  }

  /**
   * Cleanup and dispose of current timer
   */
  dispose(): void {
    if (this.currentTimer) {
      this.currentTimer.dispose();
      this.currentTimer = null;
    }
  }
}

/**
 * Utility functions for countdown timer integration
 */
export class CountdownUtils {
  /**
   * Format remaining time for display
   */
  static formatTime(seconds: number): string {
    if (seconds <= 0) {
      return '0s';
    }
    return `${Math.ceil(seconds)}s`;
  }

  /**
   * Get appropriate emoji for countdown state
   */
  static getStateEmoji(state: CountdownState): string {
    switch (state) {
      case CountdownState.RUNNING:
        return '⏳';
      case CountdownState.COMPLETED:
        return '✅';
      case CountdownState.CANCELLED:
        return '❌';
      case CountdownState.IDLE:
      default:
        return '⏸️';
    }
  }

  /**
   * Create countdown message for UI display
   */
  static createCountdownMessage(remaining: number, canCancel: boolean = true): string {
    const emoji = remaining > 0 ? '⏳' : '✅';
    const time = CountdownUtils.formatTime(remaining);
    const cancelHint = canCancel && remaining > 0 ? ' (ESC to cancel)' : '';
    
    if (remaining > 0) {
      return `${emoji} Auto-accept in ${time}${cancelHint}`;
    } else {
      return `${emoji} Auto-accepting...`;
    }
  }

  /**
   * Calculate progress percentage (0-100)
   */
  static calculateProgress(elapsed: number, total: number): number {
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }
}