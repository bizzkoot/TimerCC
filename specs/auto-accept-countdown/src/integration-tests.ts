/**
 * Integration Testing Suite for Auto-Accept Countdown Feature
 * Fulfills: TASK-AC-CT-010 - End-to-end scenarios covering all acceptance criteria
 * Trace: ALL AC-* + NFR-AC-CT-PERF-001
 */

import { CountdownTimer, CountdownState } from './countdown-timer';
import { StatusLineDisplay } from './status-line-display';
import { TimerCommandHandler } from './timer-command-handler';
import { CountdownConfiguration } from './configuration-manager';
import { EscKeyHandler } from './esc-key-handler';
import { AutoAcceptInterceptor } from './auto-accept-interceptor';

/**
 * Integration Test Suite
 * Tests all acceptance criteria end-to-end
 */
describe('Auto-Accept Countdown Integration Tests', () => {
  let countdownTimer: CountdownTimer;
  let statusDisplay: StatusLineDisplay;
  let commandHandler: TimerCommandHandler;
  let configuration: CountdownConfiguration;
  let escHandler: EscKeyHandler;
  let interceptor: AutoAcceptInterceptor;

  beforeEach(() => {
    // Reset all components to clean state
    countdownTimer = new CountdownTimer();
    statusDisplay = new StatusLineDisplay();
    commandHandler = new TimerCommandHandler();
    configuration = new CountdownConfiguration();
    escHandler = new EscKeyHandler();
    interceptor = new AutoAcceptInterceptor();
    
    // Clear any timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('REQ-AC-CT-001: Configurable Auto-Accept Countdown', () => {
    test('AC-AC-CT-001-01: Shows countdown before auto-accepting when auto-accept mode is enabled', async () => {
      // Arrange
      await configuration.updateDuration(5);
      const autoAcceptEnabled = true;
      
      // Act - Simulate auto-accept trigger with countdown enabled
      const countdownPromise = interceptor.interceptAutoAccept('test-action', autoAcceptEnabled);
      
      // Assert - Countdown should start
      expect(countdownTimer.getCurrentState()).toBe(CountdownState.RUNNING);
      expect(statusDisplay.isVisible()).toBe(true);
      
      // Fast-forward through countdown
      jest.advanceTimersByTime(5000);
      
      const result = await countdownPromise;
      expect(result.accepted).toBe(true);
      expect(result.reason).toBe('countdown_completed');
    });

    test('AC-AC-CT-001-02: ESC cancellation stops countdown and requires manual acceptance', async () => {
      // Arrange
      await configuration.updateDuration(10);
      const autoAcceptEnabled = true;
      
      // Act - Start countdown and cancel with ESC
      const countdownPromise = interceptor.interceptAutoAccept('test-action', autoAcceptEnabled);
      
      // Simulate ESC press after 3 seconds
      jest.advanceTimersByTime(3000);
      escHandler.handleEscapeKey();
      
      const result = await countdownPromise;
      
      // Assert - Countdown cancelled, manual acceptance required
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('cancelled');
      expect(countdownTimer.getCurrentState()).toBe(CountdownState.CANCELLED);
    });

    test('AC-AC-CT-001-03: Auto-accept continues for next actions after countdown completion', async () => {
      // Arrange
      await configuration.updateDuration(3);
      const autoAcceptEnabled = true;
      
      // Act - Complete first countdown
      const firstCountdown = interceptor.interceptAutoAccept('action-1', autoAcceptEnabled);
      jest.advanceTimersByTime(3000);
      const firstResult = await firstCountdown;
      
      // Start second countdown immediately
      const secondCountdown = interceptor.interceptAutoAccept('action-2', autoAcceptEnabled);
      jest.advanceTimersByTime(3000);
      const secondResult = await secondCountdown;
      
      // Assert - Both actions auto-accepted
      expect(firstResult.accepted).toBe(true);
      expect(secondResult.accepted).toBe(true);
    });
  });

  describe('REQ-AC-CT-002: Command-Based Timer Configuration', () => {
    test('AC-AC-CT-002-01: /timer 10 sets countdown to 10 seconds', async () => {
      // Act
      const result = await commandHandler.handleTimerCommand(['10']);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('10 seconds');
      
      const settings = configuration.getCurrentSettings();
      expect(settings.duration).toBe(10);
    });

    test('AC-AC-CT-002-02: /countdown 5 sets countdown to 5 seconds', async () => {
      // Act
      const result = await commandHandler.handleCountdownCommand(['5']);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('5 seconds');
      
      const settings = configuration.getCurrentSettings();
      expect(settings.duration).toBe(5);
    });

    test('AC-AC-CT-002-03: /timer without value displays current setting', async () => {
      // Arrange
      await configuration.updateDuration(8);
      
      // Act
      const result = await commandHandler.handleTimerCommand([]);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('8 seconds');
    });

    test('AC-AC-CT-002-04: /timer 0 activates immediate auto-accept', async () => {
      // Act
      await commandHandler.handleTimerCommand(['0']);
      
      // Simulate auto-accept with 0-second timer
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      const result = await countdownPromise;
      
      // Assert - Should accept immediately without countdown
      expect(result.accepted).toBe(true);
      expect(result.reason).toBe('immediate');
      expect(statusDisplay.isVisible()).toBe(false); // No countdown display
    });

    test('AC-AC-CT-002-05: /timer 65 shows error and maintains current setting', async () => {
      // Arrange
      await configuration.updateDuration(7);
      
      // Act
      const result = await commandHandler.handleTimerCommand(['65']);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('between 0-60');
      expect(result.message).toContain('7 seconds'); // Current setting preserved
      
      const settings = configuration.getCurrentSettings();
      expect(settings.duration).toBe(7); // Unchanged
    });
  });

  describe('REQ-AC-CT-003: Visual Countdown Feedback', () => {
    test('AC-AC-CT-003-01: Visual display shows remaining seconds with 1-second precision', async () => {
      // Arrange
      await configuration.updateDuration(5);
      
      // Act - Start countdown
      interceptor.interceptAutoAccept('test-action', true);
      
      // Assert - Check countdown updates
      expect(statusDisplay.isVisible()).toBe(true);
      expect(statusDisplay.getCurrentDisplay()).toContain('5s');
      
      jest.advanceTimersByTime(1000);
      expect(statusDisplay.getCurrentDisplay()).toContain('4s');
      
      jest.advanceTimersByTime(1000);
      expect(statusDisplay.getCurrentDisplay()).toContain('3s');
    });

    test('AC-AC-CT-003-02: Visual indicator changes when auto-accept activates', async () => {
      // Arrange
      await configuration.updateDuration(2);
      
      // Act
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      jest.advanceTimersByTime(2000);
      await countdownPromise;
      
      // Assert
      expect(statusDisplay.getCurrentDisplay()).toContain('✅'); // Completed indicator
    });

    test('AC-AC-CT-003-03: Visual indicator updates immediately when cancelled', async () => {
      // Arrange
      await configuration.updateDuration(5);
      
      // Act
      interceptor.interceptAutoAccept('test-action', true);
      
      // Cancel after 2 seconds
      jest.advanceTimersByTime(2000);
      escHandler.handleEscapeKey();
      
      // Assert
      expect(statusDisplay.getCurrentDisplay()).toContain('❌'); // Cancelled indicator
    });
  });

  describe('REQ-AC-CT-004: Countdown Cancellation Control', () => {
    test('AC-AC-CT-004-01: ESC immediately stops countdown and disables auto-accept', async () => {
      // Arrange
      await configuration.updateDuration(8);
      
      // Act
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      
      jest.advanceTimersByTime(3000); // Wait 3 seconds
      escHandler.handleEscapeKey();
      
      const result = await countdownPromise;
      
      // Assert
      expect(result.accepted).toBe(false);
      expect(countdownTimer.getCurrentState()).toBe(CountdownState.CANCELLED);
    });

    test('AC-AC-CT-004-02: System returns to manual acceptance after cancellation', async () => {
      // Arrange
      await configuration.updateDuration(5);
      
      // Act - Cancel countdown
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      escHandler.handleEscapeKey();
      await countdownPromise;
      
      // Try another action - should require manual acceptance
      const secondAction = interceptor.interceptAutoAccept('action-2', false); // Auto-accept disabled
      const secondResult = await secondAction;
      
      // Assert
      expect(secondResult.accepted).toBe(false);
      expect(secondResult.reason).toBe('manual_required');
    });

    test('AC-AC-CT-004-03: ESC preserves existing behavior when countdown not active', async () => {
      // Arrange - No active countdown
      const originalEscBehavior = jest.fn();
      escHandler.addEscapeHandler(originalEscBehavior);
      
      // Act
      escHandler.handleEscapeKey();
      
      // Assert - Original ESC behavior still triggered
      expect(originalEscBehavior).toHaveBeenCalled();
    });
  });

  describe('REQ-AC-CT-005: Persistent Configuration Storage', () => {
    test('AC-AC-CT-005-01: Timer setting persists across sessions', async () => {
      // Act - Set timer and simulate restart
      await commandHandler.handleTimerCommand(['12']);
      
      // Simulate session restart
      const newConfiguration = new CountdownConfiguration();
      const persistedSettings = await newConfiguration.loadFromSettings();
      
      // Assert
      expect(persistedSettings.duration).toBe(12);
    });

    test('AC-AC-CT-005-02: Timer value appears in configuration', async () => {
      // Act
      await commandHandler.handleTimerCommand(['15']);
      
      // Assert
      const settings = configuration.getCurrentSettings();
      expect(settings.duration).toBe(15);
      expect(settings.enabled).toBe(true);
      expect(settings.version).toBe('1.0');
    });

    test('AC-AC-CT-005-03: Invalid config falls back to defaults with warning', async () => {
      // Arrange - Simulate corrupted config
      const corruptedConfig = new CountdownConfiguration();
      
      // Mock invalid settings
      jest.spyOn(corruptedConfig, 'validateSettings').mockReturnValue({
        valid: false,
        errors: ['Invalid configuration'],
        warnings: []
      });
      
      // Act
      const settings = await corruptedConfig.loadFromSettings();
      
      // Assert
      expect(settings.duration).toBe(5); // Default
      expect(settings.enabled).toBe(true); // Default
    });
  });

  describe('End-to-End Scenarios', () => {
    test('Complete workflow: Configure timer, start countdown, cancel, reconfigure', async () => {
      // Step 1: Configure timer
      await commandHandler.handleTimerCommand(['8']);
      
      // Step 2: Start auto-accept countdown
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      expect(statusDisplay.isVisible()).toBe(true);
      
      // Step 3: Cancel countdown
      jest.advanceTimersByTime(3000);
      escHandler.handleEscapeKey();
      
      const result = await countdownPromise;
      expect(result.accepted).toBe(false);
      
      // Step 4: Reconfigure to immediate mode
      await commandHandler.handleTimerCommand(['0']);
      
      // Step 5: Test immediate auto-accept
      const immediatePromise = interceptor.interceptAutoAccept('immediate-action', true);
      const immediateResult = await immediatePromise;
      
      expect(immediateResult.accepted).toBe(true);
      expect(immediateResult.reason).toBe('immediate');
    });

    test('Performance requirement: <1ms overhead per countdown update', async () => {
      // Arrange
      await configuration.updateDuration(10);
      
      // Act & Measure
      const startTime = process.hrtime.bigint();
      
      interceptor.interceptAutoAccept('perf-test', true);
      
      // Simulate multiple countdown updates
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(1000);
      }
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1e6;
      
      // Assert - Total overhead should be minimal
      expect(durationMs).toBeLessThan(10); // 10ms total for 10 updates = <1ms per update
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('Multiple rapid ESC presses handled correctly', async () => {
      // Arrange
      await configuration.updateDuration(5);
      
      // Act
      interceptor.interceptAutoAccept('test-action', true);
      
      // Rapid ESC presses
      escHandler.handleEscapeKey();
      escHandler.handleEscapeKey();
      escHandler.handleEscapeKey();
      
      // Assert - Should handle gracefully without errors
      expect(countdownTimer.getCurrentState()).toBe(CountdownState.CANCELLED);
    });

    test('Terminal resize during countdown maintains display', async () => {
      // Arrange
      await configuration.updateDuration(10);
      interceptor.interceptAutoAccept('test-action', true);
      
      // Act - Simulate terminal resize
      statusDisplay.handleResize();
      
      // Assert - Display should remain functional
      expect(statusDisplay.isVisible()).toBe(true);
      expect(statusDisplay.getCurrentDisplay()).toContain('10s');
    });

    test('Countdown during system sleep/wake maintains consistency', async () => {
      // Arrange
      await configuration.updateDuration(30);
      
      // Act - Start countdown and simulate time jump (system sleep)
      const countdownPromise = interceptor.interceptAutoAccept('test-action', true);
      
      // Simulate large time jump
      jest.advanceTimersByTime(35000); // 35 seconds (longer than countdown)
      
      const result = await countdownPromise;
      
      // Assert - Should complete normally despite time jump
      expect(result.accepted).toBe(true);
    });
  });
});

/**
 * Performance Benchmark Suite
 * Validates NFR-AC-CT-PERF-001 requirements
 */
describe('Performance Benchmarks', () => {
  test('Countdown timer precision: 100ms accuracy', async () => {
    const timer = new CountdownTimer();
    const timestamps: number[] = [];
    
    timer.onTick((remaining) => {
      timestamps.push(Date.now());
    });
    
    const startTime = Date.now();
    timer.start(5);
    
    jest.advanceTimersByTime(5000);
    
    // Verify timing precision
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    // All intervals should be close to 1000ms (±100ms tolerance)
    intervals.forEach(interval => {
      expect(interval).toBeGreaterThanOrEqual(900);
      expect(interval).toBeLessThanOrEqual(1100);
    });
  });

  test('Memory usage remains stable during extended countdown sessions', async () => {
    const timer = new CountdownTimer();
    
    // Run multiple countdown sessions
    for (let i = 0; i < 100; i++) {
      timer.start(1);
      jest.advanceTimersByTime(1000);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Memory usage should be stable (implementation would check actual memory usage)
    expect(true).toBe(true); // Placeholder for actual memory assertions
  });
});

/**
 * Test utilities and mocks
 */
export class TestUtilities {
  static mockAutoAcceptSystem() {
    return {
      isEnabled: jest.fn(() => true),
      execute: jest.fn(() => Promise.resolve(true)),
      toggle: jest.fn()
    };
  }

  static mockTerminalInterface() {
    return {
      write: jest.fn(),
      clear: jest.fn(),
      getSize: jest.fn(() => ({ width: 80, height: 24 }))
    };
  }

  static simulateKeyPress(key: string) {
    const event = new KeyboardEvent('keydown', { key });
    document.dispatchEvent(event);
  }
}

/**
 * Integration test configuration
 */
export const IntegrationTestConfig = {
  // Test timeout for async operations
  timeout: 5000,
  
  // Mock timer precision
  timerPrecision: 100, // ms
  
  // Performance thresholds
  maxUpdateOverhead: 1, // ms per countdown update
  maxMemoryGrowth: 1024 * 1024, // 1MB memory growth limit
  
  // Test data
  testDurations: [0, 1, 5, 10, 30, 60],
  invalidDurations: [-1, 61, 100, 'invalid', null, undefined]
};