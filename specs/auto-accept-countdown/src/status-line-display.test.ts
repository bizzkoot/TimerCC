import { TerminalStatusLineDisplay, StatusDisplayState } from './status-line-display';

describe('TerminalStatusLineDisplay', () => {
  let display: TerminalStatusLineDisplay;
  let mockStdout: any;
  let originalStdout: any;

  beforeEach(() => {
    // Mock process.stdout
    originalStdout = process.stdout;
    mockStdout = {
      write: jest.fn(),
      columns: 80,
      rows: 24,
      on: jest.fn()
    };
    Object.assign(process.stdout, mockStdout);
    
    display = new TerminalStatusLineDisplay();
  });

  afterEach(() => {
    // Restore original stdout
    Object.assign(process.stdout, originalStdout);
    jest.clearAllTimers();
  });

  describe('showCountdown', () => {
    it('should display countdown with emoji on supported terminals', () => {
      process.env.TERM_PROGRAM = 'iTerm.app';
      
      display.showCountdown(5);
      
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[s'); // Save cursor
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[24;1H'); // Move to bottom-left
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[2K'); // Clear line
      expect(mockStdout.write).toHaveBeenCalledWith('⏳ Auto-accept in 5s (ESC to cancel)');
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[u'); // Restore cursor
      expect(display.isVisible()).toBe(true);
    });

    it('should display countdown with ASCII on unsupported terminals', () => {
      delete process.env.TERM_PROGRAM;
      process.env.TERM = 'xterm';
      
      display.showCountdown(10);
      
      expect(mockStdout.write).toHaveBeenCalledWith('[COUNTDOWN] Auto-accept in 10s (ESC to cancel)');
      expect(display.isVisible()).toBe(true);
    });

    it('should update countdown display when called multiple times', () => {
      display.showCountdown(3);
      display.showCountdown(2);
      display.showCountdown(1);
      
      expect(mockStdout.write).toHaveBeenCalledWith('⏳ Auto-accept in 1s (ESC to cancel)');
    });
  });

  describe('showImmediate', () => {
    it('should display immediate mode with emoji', () => {
      process.env.TERM_PROGRAM = 'Apple_Terminal';
      
      display.showImmediate();
      
      expect(mockStdout.write).toHaveBeenCalledWith('⚡ Auto-accept enabled (immediate)');
      expect(display.isVisible()).toBe(true);
    });

    it('should display immediate mode with ASCII fallback', () => {
      delete process.env.TERM_PROGRAM;
      process.env.TERM = 'linux';
      
      display.showImmediate();
      
      expect(mockStdout.write).toHaveBeenCalledWith('[IMMEDIATE] Auto-accept enabled (immediate)');
    });
  });

  describe('showCancelled', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should display cancelled message and auto-hide after 2 seconds', () => {
      display.showCancelled();
      
      expect(mockStdout.write).toHaveBeenCalledWith('❌ Auto-accept cancelled');
      expect(display.isVisible()).toBe(true);
      
      // Fast-forward 2 seconds
      jest.advanceTimersByTime(2000);
      
      // Should be hidden after timeout
      expect(display.isVisible()).toBe(false);
    });

    it('should not auto-hide if state changed before timeout', () => {
      display.showCancelled();
      display.showCountdown(5); // Change state before timeout
      
      jest.advanceTimersByTime(2000);
      
      // Should still be visible showing countdown
      expect(display.isVisible()).toBe(true);
    });
  });

  describe('showCompleted', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should display completed message and auto-hide after 1 second', () => {
      display.showCompleted();
      
      expect(mockStdout.write).toHaveBeenCalledWith('✅ Auto-accepting...');
      expect(display.isVisible()).toBe(true);
      
      jest.advanceTimersByTime(1000);
      
      expect(display.isVisible()).toBe(false);
    });
  });

  describe('hide', () => {
    it('should clear status line when visible', () => {
      display.showCountdown(5);
      display.hide();
      
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[s'); // Save cursor
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[24;1H'); // Move to bottom
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[2K'); // Clear line
      expect(mockStdout.write).toHaveBeenCalledWith('\x1b[u'); // Restore cursor
      expect(display.isVisible()).toBe(false);
    });

    it('should do nothing if already hidden', () => {
      const writeCallsBefore = mockStdout.write.mock.calls.length;
      
      display.hide(); // Already hidden
      
      const writeCallsAfter = mockStdout.write.mock.calls.length;
      expect(writeCallsAfter).toBe(writeCallsBefore);
    });
  });

  describe('handleResize', () => {
    it('should re-render status line when visible', () => {
      display.showCountdown(3);
      mockStdout.write.mockClear();
      
      display.handleResize();
      
      expect(mockStdout.write).toHaveBeenCalledWith('⏳ Auto-accept in 3s (ESC to cancel)');
    });

    it('should do nothing when hidden', () => {
      display.handleResize();
      
      expect(mockStdout.write).not.toHaveBeenCalled();
    });
  });

  describe('emoji support detection', () => {
    it('should detect macOS emoji support', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      display.showCountdown(1);
      
      expect(mockStdout.write).toHaveBeenCalledWith('⏳ Auto-accept in 1s (ESC to cancel)');
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should detect VSCode emoji support', () => {
      process.env.TERM_PROGRAM = 'vscode';
      
      display.showImmediate();
      
      expect(mockStdout.write).toHaveBeenCalledWith('⚡ Auto-accept enabled (immediate)');
    });

    it('should fall back to ASCII for unknown terminals', () => {
      delete process.env.TERM_PROGRAM;
      process.env.TERM = 'unknown';
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      display.showCountdown(1);
      
      expect(mockStdout.write).toHaveBeenCalledWith('[COUNTDOWN] Auto-accept in 1s (ESC to cancel)');
    });
  });
});