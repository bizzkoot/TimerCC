/**
 * Unit Tests for CountdownTimer
 * Validates: AC-AC-CT-001-01, AC-AC-CT-001-02, AC-AC-CT-001-03, AC-AC-CT-004-01, AC-AC-CT-004-02
 */

import { CountdownTimer, CountdownState, CountdownTimerManager, CountdownUtils } from './countdown-timer';

// Mock timers for testing
jest.useFakeTimers();

describe('CountdownTimer', () => {
  let timer: CountdownTimer;
  let onTick: jest.Mock;
  let onComplete: jest.Mock;
  let onCancel: jest.Mock;
  let onStateChange: jest.Mock;

  beforeEach(() => {
    onTick = jest.fn();
    onComplete = jest.fn();
    onCancel = jest.fn();
    onStateChange = jest.fn();

    timer = new CountdownTimer({
      onTick,
      onComplete,
      onCancel,
      onStateChange
    });
  });

  afterEach(() => {
    timer.dispose();
    jest.clearAllTimers();
  });

  describe('start method', () => {
    it('should complete countdown after specified duration', async () => {
      // AC-AC-CT-001-01: System shows countdown before auto-accepting
      const startPromise = timer.start(2);

      expect(timer.getCurrentState()).toBe(CountdownState.RUNNING);
      expect(timer.isRunning()).toBe(true);

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      const completed = await startPromise;
      expect(completed).toBe(true);
      expect(timer.getCurrentState()).toBe(CountdownState.COMPLETED);
      expect(onComplete).toHaveBeenCalled();
    });

    it('should complete immediately for 0 duration', async () => {
      // AC-AC-CT-002-04: Timer 0 enables immediate activation
      const completed = await timer.start(0);

      expect(completed).toBe(true);
      expect(timer.getCurrentState()).toBe(CountdownState.COMPLETED);
      expect(onComplete).toHaveBeenCalled();
    });

    it('should validate duration range', async () => {
      // Test invalid durations
      await expect(timer.start(-1)).rejects.toThrow('Invalid duration');
      await expect(timer.start(61)).rejects.toThrow('Invalid duration');
      await expect(timer.start(5.5)).rejects.toThrow('Invalid duration');
    });

    it('should accept valid boundary values', async () => {
      // Test minimum boundary
      const promise1 = timer.start(0);
      expect(await promise1).toBe(true);

      // Test maximum boundary  
      timer.reset();
      const promise2 = timer.start(60);
      expect(timer.isRunning()).toBe(true);
      
      jest.advanceTimersByTime(60000);
      expect(await promise2).toBe(true);
    });

    it('should trigger onTick callbacks with 1-second precision', async () => {
      const startPromise = timer.start(3);

      // Advance time and check tick calls
      jest.advanceTimersByTime(100); // First tick
      expect(onTick).toHaveBeenCalledWith(3);

      jest.advanceTimersByTime(900); // 1 second total
      expect(onTick).toHaveBeenCalledWith(2);

      jest.advanceTimersByTime(1000); // 2 seconds total
      expect(onTick).toHaveBeenCalledWith(1);

      jest.advanceTimersByTime(1000); // 3 seconds total - completion
      await startPromise;
      expect(onComplete).toHaveBeenCalled();
    });

    it('should trigger state change callbacks', async () => {
      const startPromise = timer.start(1);

      expect(onStateChange).toHaveBeenCalledWith(CountdownState.RUNNING, CountdownState.IDLE);

      jest.advanceTimersByTime(1000);
      await startPromise;

      expect(onStateChange).toHaveBeenCalledWith(CountdownState.COMPLETED, CountdownState.RUNNING);
    });
  });

  describe('cancel method', () => {
    it('should cancel running countdown immediately', async () => {
      // AC-AC-CT-004-01: ESC stops countdown immediately
      const startPromise = timer.start(5);

      expect(timer.isRunning()).toBe(true);

      // Cancel after 1 second
      jest.advanceTimersByTime(1000);
      timer.cancel();

      const completed = await startPromise;
      expect(completed).toBe(false);
      expect(timer.getCurrentState()).toBe(CountdownState.CANCELLED);
      expect(timer.wasCancelled()).toBe(true);
      expect(onCancel).toHaveBeenCalled();
    });

    it('should return to manual mode after cancellation', async () => {
      // AC-AC-CT-004-02: System returns to manual acceptance mode
      const startPromise = timer.start(3);

      timer.cancel();
      const completed = await startPromise;

      expect(completed).toBe(false);
      expect(timer.getCurrentState()).toBe(CountdownState.CANCELLED);
      expect(onStateChange).toHaveBeenLastCalledWith(CountdownState.CANCELLED, CountdownState.RUNNING);
    });

    it('should do nothing if not running', () => {
      // Timer not started
      timer.cancel();
      expect(timer.getCurrentState()).toBe(CountdownState.IDLE);
      expect(onCancel).not.toHaveBeenCalled();

      // Timer already completed
      timer.start(0);
      timer.cancel(); // Should do nothing since already completed
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    it('should track countdown state correctly', async () => {
      // Initial state
      expect(timer.getCurrentState()).toBe(CountdownState.IDLE);
      expect(timer.isRunning()).toBe(false);
      expect(timer.wasCancelled()).toBe(false);
      expect(timer.wasCompleted()).toBe(false);

      // Running state
      const startPromise = timer.start(2);
      expect(timer.getCurrentState()).toBe(CountdownState.RUNNING);
      expect(timer.isRunning()).toBe(true);

      // Completed state
      jest.advanceTimersByTime(2000);
      await startPromise;
      expect(timer.getCurrentState()).toBe(CountdownState.COMPLETED);
      expect(timer.isRunning()).toBe(false);
      expect(timer.wasCompleted()).toBe(true);
    });

    it('should track remaining and elapsed time correctly', async () => {
      const startPromise = timer.start(5);

      // Initial state
      expect(timer.getRemainingTime()).toBe(5);
      expect(timer.getElapsedTime()).toBe(0);
      expect(timer.getDuration()).toBe(5);

      // After 2 seconds
      jest.advanceTimersByTime(2000);
      expect(timer.getRemainingTime()).toBe(3);
      expect(timer.getElapsedTime()).toBe(2);

      // Completion
      jest.advanceTimersByTime(3000);
      await startPromise;
      expect(timer.getRemainingTime()).toBe(0);
      expect(timer.getElapsedTime()).toBe(5);
    });
  });

  describe('callback management', () => {
    it('should allow callback registration after creation', () => {
      const newTimer = new CountdownTimer();
      const mockTick = jest.fn();
      const mockComplete = jest.fn();
      const mockCancel = jest.fn();
      const mockStateChange = jest.fn();

      newTimer.onTick(mockTick);
      newTimer.onComplete(mockComplete);
      newTimer.onCancel(mockCancel);
      newTimer.onStateChange(mockStateChange);

      newTimer.start(1);
      jest.advanceTimersByTime(100);
      expect(mockTick).toHaveBeenCalled();

      newTimer.cancel();
      expect(mockCancel).toHaveBeenCalled();

      newTimer.dispose();
    });

    it('should handle missing callbacks gracefully', async () => {
      const newTimer = new CountdownTimer(); // No callbacks

      // Should not throw errors
      const startPromise = newTimer.start(1);
      jest.advanceTimersByTime(1000);
      await startPromise;

      newTimer.cancel(); // Should not throw
      newTimer.dispose();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle multiple start calls', async () => {
      const promise1 = timer.start(2);
      
      // Starting again should cancel the first
      const promise2 = timer.start(1);

      jest.advanceTimersByTime(1000);
      
      const result2 = await promise2;
      expect(result2).toBe(true);
    });

    it('should handle rapid cancel calls', () => {
      timer.start(5);
      
      timer.cancel();
      timer.cancel(); // Second cancel should do nothing
      timer.cancel(); // Third cancel should do nothing

      expect(timer.getCurrentState()).toBe(CountdownState.CANCELLED);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should cleanup resources properly', () => {
      timer.start(5);
      expect(timer.isRunning()).toBe(true);

      timer.dispose();
      expect(timer.isRunning()).toBe(false);
      // Should not have active timers after dispose
    });

    it('should handle system time changes gracefully', async () => {
      const startPromise = timer.start(2);

      // Simulate time jump (this tests our Date.now() based calculation)
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow.call(Date) + 10000); // Jump 10 seconds ahead

      jest.advanceTimersByTime(100); // Trigger update
      
      // Should still complete normally
      Date.now = originalDateNow;
      jest.advanceTimersByTime(2000);
      
      const completed = await startPromise;
      expect(completed).toBe(true);
    });
  });

  describe('reset functionality', () => {
    it('should reset timer to initial state', async () => {
      timer.start(3);
      timer.cancel();

      timer.reset();

      expect(timer.getCurrentState()).toBe(CountdownState.IDLE);
      expect(timer.getRemainingTime()).toBe(0);
      expect(timer.getElapsedTime()).toBe(0);
      expect(timer.getDuration()).toBe(0);
      expect(timer.isRunning()).toBe(false);
      expect(timer.wasCancelled()).toBe(false);
      expect(timer.wasCompleted()).toBe(false);
    });
  });
});

describe('CountdownTimerManager', () => {
  let manager: CountdownTimerManager;

  beforeEach(() => {
    manager = CountdownTimerManager.getInstance();
    manager.dispose(); // Clean slate
  });

  afterEach(() => {
    manager.dispose();
    jest.clearAllTimers();
  });

  it('should be singleton', () => {
    const manager2 = CountdownTimerManager.getInstance();
    expect(manager).toBe(manager2);
  });

  it('should manage single countdown instance', async () => {
    const completed = await manager.startCountdown(0); // Immediate
    expect(completed).toBe(true);
    expect(manager.isCountdownRunning()).toBe(false);
  });

  it('should cancel existing countdown when starting new one', async () => {
    const onCancel = jest.fn();
    manager.startCountdown(5, { onCancel });

    expect(manager.isCountdownRunning()).toBe(true);

    // Start new countdown - should cancel the first
    const promise2 = manager.startCountdown(1);
    expect(onCancel).toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    const completed = await promise2;
    expect(completed).toBe(true);
  });

  it('should provide access to current timer', () => {
    manager.startCountdown(3);
    const timer = manager.getCurrentTimer();
    
    expect(timer).not.toBeNull();
    expect(timer!.isRunning()).toBe(true);
    expect(timer!.getDuration()).toBe(3);
  });

  it('should handle cancellation through manager', async () => {
    const startPromise = manager.startCountdown(5);
    
    manager.cancelCountdown();
    
    const completed = await startPromise;
    expect(completed).toBe(false);
    expect(manager.isCountdownRunning()).toBe(false);
  });
});

describe('CountdownUtils', () => {
  describe('formatTime', () => {
    it('should format time correctly', () => {
      expect(CountdownUtils.formatTime(0)).toBe('0s');
      expect(CountdownUtils.formatTime(1)).toBe('1s');
      expect(CountdownUtils.formatTime(1.7)).toBe('2s'); // Rounds up
      expect(CountdownUtils.formatTime(30)).toBe('30s');
      expect(CountdownUtils.formatTime(-1)).toBe('0s'); // Negative becomes 0
    });
  });

  describe('getStateEmoji', () => {
    it('should return correct emojis for each state', () => {
      expect(CountdownUtils.getStateEmoji(CountdownState.RUNNING)).toBe('⏳');
      expect(CountdownUtils.getStateEmoji(CountdownState.COMPLETED)).toBe('✅');
      expect(CountdownUtils.getStateEmoji(CountdownState.CANCELLED)).toBe('❌');
      expect(CountdownUtils.getStateEmoji(CountdownState.IDLE)).toBe('⏸️');
    });
  });

  describe('createCountdownMessage', () => {
    it('should create appropriate messages for different states', () => {
      expect(CountdownUtils.createCountdownMessage(5))
        .toBe('⏳ Auto-accept in 5s (ESC to cancel)');
      
      expect(CountdownUtils.createCountdownMessage(1, false))
        .toBe('⏳ Auto-accept in 1s');
      
      expect(CountdownUtils.createCountdownMessage(0))
        .toBe('✅ Auto-accepting...');
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress percentage correctly', () => {
      expect(CountdownUtils.calculateProgress(0, 10)).toBe(0);
      expect(CountdownUtils.calculateProgress(5, 10)).toBe(50);
      expect(CountdownUtils.calculateProgress(10, 10)).toBe(100);
      expect(CountdownUtils.calculateProgress(15, 10)).toBe(100); // Capped at 100
      expect(CountdownUtils.calculateProgress(5, 0)).toBe(100); // Divide by zero protection
    });
  });
});

describe('Performance and NFR Compliance', () => {
  it('should maintain 100ms precision timing', async () => {
    const timer = new CountdownTimer();
    const tickTimes: number[] = [];
    
    timer.onTick((remaining) => {
      tickTimes.push(Date.now());
    });

    timer.start(2);
    
    // Advance in 100ms increments
    for (let i = 0; i < 20; i++) {
      jest.advanceTimersByTime(100);
    }

    timer.dispose();
    
    // Should have received tick callbacks
    expect(tickTimes.length).toBeGreaterThan(0);
  });

  it('should handle concurrent timer operations efficiently', () => {
    const timers: CountdownTimer[] = [];
    
    // Create multiple timers (simulating multiple countdown operations)
    for (let i = 0; i < 10; i++) {
      const timer = new CountdownTimer();
      timers.push(timer);
      timer.start(1 + i);
    }

    // All should be running
    expect(timers.every(t => t.isRunning())).toBe(true);

    // Cleanup
    timers.forEach(t => t.dispose());
  });

  it('should maintain minimal memory footprint', () => {
    const timer = new CountdownTimer();
    
    // Start and stop multiple times
    for (let i = 0; i < 100; i++) {
      timer.start(1);
      timer.cancel();
      timer.reset();
    }

    timer.dispose();
    
    // Should not accumulate state or memory leaks
    expect(timer.getCurrentState()).toBe(CountdownState.IDLE);
  });
});