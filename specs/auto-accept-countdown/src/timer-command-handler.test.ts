/**
 * Unit Tests for TimerCommandHandler
 * Validates: AC-AC-CT-002-01, AC-AC-CT-002-02, AC-AC-CT-002-03, AC-AC-CT-002-04, AC-AC-CT-002-05
 */

import { TimerCommandHandler, CommandResult, ValidationResult } from './timer-command-handler';
import { CountdownConfiguration } from './configuration-manager';

describe('TimerCommandHandler', () => {
  let handler: TimerCommandHandler;
  let mockConfig: jest.Mocked<CountdownConfiguration>;

  beforeEach(() => {
    // Create mock configuration manager
    mockConfig = {
      updateDuration: jest.fn().mockResolvedValue(undefined),
      getCurrentSettings: jest.fn().mockReturnValue({
        duration: 5,
        enabled: true,
        version: '1.0'
      }),
      loadFromSettings: jest.fn(),
      saveToSettings: jest.fn(),
      getDefaultSettings: jest.fn(),
      validateSettings: jest.fn(),
      toggleEnabled: jest.fn()
    } as any;

    handler = new TimerCommandHandler(mockConfig);
  });

  describe('handleTimerCommand', () => {
    it('should set duration to specified value', async () => {
      // AC-AC-CT-002-01: /timer 10 sets duration to 10 seconds
      const result = await handler.handleTimerCommand(['10']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('10 seconds');
      expect(mockConfig.updateDuration).toHaveBeenCalledWith(10);
    });

    it('should show current setting when no arguments provided', async () => {
      // AC-AC-CT-002-03: /timer without value displays current setting
      const result = await handler.handleTimerCommand([]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('5 seconds');
      expect(mockConfig.updateDuration).not.toHaveBeenCalled();
    });

    it('should enable immediate mode for 0 seconds', async () => {
      // AC-AC-CT-002-04: /timer 0 enables immediate activation
      const result = await handler.handleTimerCommand(['0']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('immediate activation');
      expect(result.message).toContain('⚡');
      expect(mockConfig.updateDuration).toHaveBeenCalledWith(0);
    });

    it('should reject values exceeding maximum', async () => {
      // AC-AC-CT-002-05: /timer 65 shows error (max 60 seconds)  
      const result = await handler.handleTimerCommand(['65']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot exceed 60 seconds');
      expect(mockConfig.updateDuration).not.toHaveBeenCalled();
    });

    it('should accept maximum boundary value', async () => {
      const result = await handler.handleTimerCommand(['60']);

      expect(result.success).toBe(true);
      expect(result.message).toContain('60 seconds');
      expect(mockConfig.updateDuration).toHaveBeenCalledWith(60);
    });

    it('should reject negative values', async () => {
      const result = await handler.handleTimerCommand(['-5']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot be negative');
      expect(mockConfig.updateDuration).not.toHaveBeenCalled();
    });

    it('should reject non-numeric values', async () => {
      const result = await handler.handleTimerCommand(['abc']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be a number');
      expect(mockConfig.updateDuration).not.toHaveBeenCalled();
    });

    it('should reject decimal values', async () => {
      const result = await handler.handleTimerCommand(['5.5']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('must be a whole number');
      expect(mockConfig.updateDuration).not.toHaveBeenCalled();
    });

    it('should handle configuration manager errors gracefully', async () => {
      mockConfig.updateDuration.mockRejectedValue(new Error('Save failed'));

      const result = await handler.handleTimerCommand(['10']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Save failed');
    });
  });

  describe('handleCountdownCommand', () => {
    it('should have identical behavior to timer command', async () => {
      // AC-AC-CT-002-02: /countdown 5 sets duration to 5 seconds
      const timerResult = await handler.handleTimerCommand(['5']);
      const countdownResult = await handler.handleCountdownCommand(['5']);

      expect(countdownResult).toEqual(timerResult);
      expect(mockConfig.updateDuration).toHaveBeenCalledTimes(2);
      expect(mockConfig.updateDuration).toHaveBeenNthCalledWith(1, 5);
      expect(mockConfig.updateDuration).toHaveBeenNthCalledWith(2, 5);
    });

    it('should show current setting when no arguments provided', async () => {
      // AC-AC-CT-002-03: Shows current setting for both commands
      const result = await handler.handleCountdownCommand([]);

      expect(result.success).toBe(true);
      expect(result.message).toContain('5 seconds');
    });
  });

  describe('validateDuration', () => {
    it('should validate correct duration values', () => {
      const testCases = [
        { input: '0', expected: 0, description: 'minimum boundary' },
        { input: '1', expected: 1, description: 'minimal positive' },
        { input: '30', expected: 30, description: 'middle range' },
        { input: '60', expected: 60, description: 'maximum boundary' }
      ];

      testCases.forEach(({ input, expected, description }) => {
        const result = handler.validateDuration(input);
        expect(result.valid).toBe(true, `${description} should be valid`);
        expect(result.value).toBe(expected, `${description} should return correct value`);
      });
    });

    it('should reject invalid duration values', () => {
      const testCases = [
        { input: '', error: 'Duration value is required' },
        { input: '   ', error: 'Duration value is required' },
        { input: 'abc', error: 'Duration must be a number' },
        { input: '5.5', error: 'Duration must be a whole number' },
        { input: '-1', error: 'Duration cannot be negative' },
        { input: '61', error: 'Duration cannot exceed 60 seconds' },
        { input: '100', error: 'Duration cannot exceed 60 seconds' }
      ];

      testCases.forEach(({ input, error }) => {
        const result = handler.validateDuration(input);
        expect(result.valid).toBe(false, `Input '${input}' should be invalid`);
        expect(result.error).toContain(error.split(' ')[0], `Input '${input}' should have correct error`);
      });
    });

    it('should handle edge cases', () => {
      // Whitespace handling
      expect(handler.validateDuration(' 5 ').valid).toBe(true);
      expect(handler.validateDuration(' 5 ').value).toBe(5);

      // Large numbers that convert to valid range
      expect(handler.validateDuration('5.0').valid).toBe(false); // Should reject decimals
    });
  });

  describe('showCurrentSetting', () => {
    it('should show enabled countdown setting', async () => {
      mockConfig.getCurrentSettings.mockReturnValue({
        duration: 10,
        enabled: true,
        version: '1.0'
      });

      const result = await handler.showCurrentSetting();

      expect(result.success).toBe(true);
      expect(result.message).toContain('10 seconds');
      expect(result.message).toContain('⏳');
      expect(result.data).toEqual({
        duration: 10,
        enabled: true,
        version: '1.0'
      });
    });

    it('should show disabled countdown setting', async () => {
      mockConfig.getCurrentSettings.mockReturnValue({
        duration: 5,
        enabled: false,
        version: '1.0'
      });

      const result = await handler.showCurrentSetting();

      expect(result.success).toBe(true);
      expect(result.message).toContain('DISABLED');
      expect(result.message).toContain('🔧');
    });

    it('should show immediate mode setting', async () => {
      mockConfig.getCurrentSettings.mockReturnValue({
        duration: 0,
        enabled: true,
        version: '1.0'
      });

      const result = await handler.showCurrentSetting();

      expect(result.success).toBe(true);
      expect(result.message).toContain('immediate activation');
      expect(result.message).toContain('⚡');
    });

    it('should handle errors gracefully', async () => {
      mockConfig.getCurrentSettings.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await handler.showCurrentSetting();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to retrieve current setting');
    });
  });

  describe('processBatchCommands', () => {
    it('should process multiple timer commands', async () => {
      const commands = [
        { type: 'timer' as const, args: ['10'] },
        { type: 'countdown' as const, args: ['5'] },
        { type: 'timer' as const, args: [] }
      ];

      const results = await handler.processBatchCommands(commands);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(mockConfig.updateDuration).toHaveBeenCalledWith(10);
      expect(mockConfig.updateDuration).toHaveBeenCalledWith(5);
    });

    it('should handle batch command errors', async () => {
      mockConfig.updateDuration.mockRejectedValueOnce(new Error('Save failed'));

      const commands = [
        { type: 'timer' as const, args: ['10'] },
        { type: 'timer' as const, args: ['20'] }
      ];

      const results = await handler.processBatchCommands(commands);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Static Methods', () => {
    it('should provide correct command registration info', () => {
      const commands = TimerCommandHandler.registerCommands();
      
      expect(commands.timer).toBe('/timer');
      expect(commands.countdown).toBe('/countdown');
    });

    it('should provide comprehensive help text', () => {
      const help = TimerCommandHandler.getHelpText();
      
      expect(help.timer).toContain('/timer');
      expect(help.timer).toContain('0-60 seconds');
      expect(help.timer).toContain('Examples:');
      
      expect(help.countdown).toContain('/countdown');
      expect(help.countdown).toContain('0-60 seconds');
      expect(help.countdown).toContain('Examples:');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle rapid command changes', async () => {
      // Simulate user rapidly changing timer values
      const commands = ['5', '10', '0', '30'];
      const results: CommandResult[] = [];

      for (const cmd of commands) {
        const result = await handler.handleTimerCommand([cmd]);
        results.push(result);
      }

      expect(results.every(r => r.success)).toBe(true);
      expect(mockConfig.updateDuration).toHaveBeenCalledTimes(4);
      expect(mockConfig.updateDuration).toHaveBeenLastCalledWith(30);
    });

    it('should provide helpful error messages with current setting', async () => {
      const result = await handler.handleTimerCommand(['100']);

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot exceed 60 seconds');
      expect(result.message).toContain('5 seconds'); // Shows current setting
    });

    it('should handle empty string and whitespace inputs', async () => {
      const inputs = ['', '   ', '\t', '\n'];
      
      for (const input of inputs) {
        const result = await handler.handleTimerCommand([input]);
        expect(result.success).toBe(false);
        expect(result.message).toContain('Duration value is required');
      }
    });
  });
});