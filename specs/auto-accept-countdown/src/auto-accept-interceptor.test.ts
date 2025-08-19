import {
  CountdownAutoAcceptInterceptor,
  AutoAcceptManager,
  AutoAcceptAction,
  createAutoAcceptSystem,
  globalAutoAcceptManager
} from './auto-accept-interceptor';
import { CountdownTimer } from './countdown-timer';
import { StatusLineDisplay } from './status-line-display';
import { CountdownConfiguration } from './configuration-manager';

// Mock dependencies
jest.mock('./countdown-timer');
jest.mock('./status-line-display');
jest.mock('./configuration-manager');
jest.mock('./esc-key-handler', () => ({
  globalESCHandlerChain: {
    setCountdownCancelCallback: jest.fn()
  }
}));

describe('CountdownAutoAcceptInterceptor', () => {
  let interceptor: CountdownAutoAcceptInterceptor;
  let mockTimer: jest.Mocked<CountdownTimer>;
  let mockStatusDisplay: jest.Mocked<StatusLineDisplay>;
  let mockConfig: jest.Mocked<CountdownConfiguration>;

  beforeEach(() => {
    mockTimer = new CountdownTimer() as jest.Mocked<CountdownTimer>;
    mockStatusDisplay = {
      showCountdown: jest.fn(),
      showImmediate: jest.fn(),
      showCancelled: jest.fn(),
      showCompleted: jest.fn(),
      hide: jest.fn(),
      isVisible: jest.fn(),
      handleResize: jest.fn()
    } as jest.Mocked<StatusLineDisplay>;
    mockConfig = new CountdownConfiguration() as jest.Mocked<CountdownConfiguration>;
    
    // Setup default config mock
    mockConfig.loadFromSettings.mockReturnValue({
      duration: 5,
      enabled: true,
      version: '1.0'
    });

    interceptor = new CountdownAutoAcceptInterceptor(mockTimer, mockStatusDisplay, mockConfig);
  });

  describe('interceptAction', () => {
    let testAction: AutoAcceptAction;

    beforeEach(() => {
      testAction = {
        id: 'test-action-1',
        type: 'file-edit',
        description: 'Edit test file',
        execute: jest.fn().mockResolvedValue(undefined)
      };
    });

    it('should execute immediately when countdown is disabled', async () => {
      mockConfig.loadFromSettings.mockReturnValue({
        duration: 5,
        enabled: false,
        version: '1.0'
      });

      const result = await interceptor.interceptAction(testAction);

      expect(result).toBe(true);
      expect(mockStatusDisplay.showImmediate).toHaveBeenCalled();
      expect(testAction.execute).toHaveBeenCalled();
      expect(mockTimer.start).not.toHaveBeenCalled();
    });

    it('should execute immediately when duration is 0', async () => {
      mockConfig.loadFromSettings.mockReturnValue({
        duration: 0,
        enabled: true,
        version: '1.0'
      });

      const result = await interceptor.interceptAction(testAction);

      expect(result).toBe(true);
      expect(mockStatusDisplay.showImmediate).toHaveBeenCalled();
      expect(testAction.execute).toHaveBeenCalled();
      expect(mockTimer.start).not.toHaveBeenCalled();
    });

    it('should start countdown when enabled with duration > 0', async () => {
      mockTimer.start.mockResolvedValue(true); // Countdown completed

      const result = await interceptor.interceptAction(testAction);

      expect(mockTimer.start).toHaveBeenCalledWith(5);
      expect(result).toBe(true);
      expect(mockStatusDisplay.showCompleted).toHaveBeenCalled();
      expect(testAction.execute).toHaveBeenCalled();
    });

    it('should return false when countdown is cancelled', async () => {
      mockTimer.start.mockResolvedValue(false); // Countdown cancelled

      const result = await interceptor.interceptAction(testAction);

      expect(result).toBe(false);
      expect(mockStatusDisplay.showCancelled).toHaveBeenCalled();
      expect(testAction.execute).not.toHaveBeenCalled();
    });

    it('should handle timer errors gracefully', async () => {
      mockTimer.start.mockRejectedValue(new Error('Timer error'));

      const result = await interceptor.interceptAction(testAction);

      expect(result).toBe(false);
      expect(mockStatusDisplay.hide).toHaveBeenCalled();
      expect(testAction.execute).not.toHaveBeenCalled();
    });

    it('should handle action execution errors', async () => {
      mockTimer.start.mockResolvedValue(true);
      testAction.execute = jest.fn().mockRejectedValue(new Error('Execution failed'));

      await expect(interceptor.interceptAction(testAction)).rejects.toThrow('Execution failed');
    });
  });

  describe('countdown management', () => {
    it('should track countdown active state', () => {
      expect(interceptor.isCountdownActive()).toBe(false);
    });

    it('should cancel current countdown', () => {
      // Simulate active countdown
      (interceptor as any).countdownActive = true;
      
      interceptor.cancelCurrentCountdown();
      
      expect(mockTimer.cancel).toHaveBeenCalled();
      expect(mockStatusDisplay.showCancelled).toHaveBeenCalled();
      expect(interceptor.isCountdownActive()).toBe(false);
    });

    it('should do nothing when cancelling inactive countdown', () => {
      interceptor.cancelCurrentCountdown();
      
      expect(mockTimer.cancel).not.toHaveBeenCalled();
      expect(mockStatusDisplay.showCancelled).not.toHaveBeenCalled();
    });
  });

  describe('duration configuration', () => {
    it('should set countdown duration', () => {
      interceptor.setCountdownDuration(10);
      
      expect(mockConfig.saveToSettings).toHaveBeenCalledWith({
        duration: 10,
        enabled: true,
        version: '1.0'
      });
    });

    it('should validate duration range', () => {
      expect(() => interceptor.setCountdownDuration(-1)).toThrow();
      expect(() => interceptor.setCountdownDuration(61)).toThrow();
      expect(() => interceptor.setCountdownDuration(30)).not.toThrow();
    });

    it('should get current countdown duration', () => {
      const duration = interceptor.getCountdownDuration();
      expect(duration).toBe(5);
      expect(mockConfig.loadFromSettings).toHaveBeenCalled();
    });
  });

  describe('timer callbacks', () => {
    it('should setup timer tick callback', () => {
      expect(mockTimer.onTick).toHaveBeenCalled();
      
      // Get the callback and test it
      const tickCallback = mockTimer.onTick.mock.calls[0][0];
      (interceptor as any).countdownActive = true;
      
      tickCallback(3);
      expect(mockStatusDisplay.showCountdown).toHaveBeenCalledWith(3);
    });

    it('should setup timer cancel callback', () => {
      expect(mockTimer.onCancel).toHaveBeenCalled();
      
      // Get the callback and test it
      const cancelCallback = mockTimer.onCancel.mock.calls[0][0];
      (interceptor as any).countdownActive = true;
      
      cancelCallback();
      expect((interceptor as any).countdownActive).toBe(false);
      expect((interceptor as any).currentAction).toBeNull();
    });
  });
});

describe('AutoAcceptManager', () => {
  let manager: AutoAcceptManager;
  let mockInterceptor: jest.Mocked<CountdownAutoAcceptInterceptor>;

  beforeEach(() => {
    mockInterceptor = {
      interceptAction: jest.fn(),
      isCountdownActive: jest.fn(),
      cancelCurrentCountdown: jest.fn(),
      setCountdownDuration: jest.fn(),
      getCountdownDuration: jest.fn().mockReturnValue(5)
    } as any;

    manager = new AutoAcceptManager(mockInterceptor);
  });

  describe('auto-accept state management', () => {
    it('should start with auto-accept disabled', () => {
      expect(manager.isAutoAcceptEnabled()).toBe(false);
    });

    it('should toggle auto-accept state', () => {
      const result = manager.toggleAutoAccept();
      
      expect(result).toBe(true);
      expect(manager.isAutoAcceptEnabled()).toBe(true);
      
      const result2 = manager.toggleAutoAccept();
      expect(result2).toBe(false);
      expect(manager.isAutoAcceptEnabled()).toBe(false);
    });

    it('should cancel countdown when disabling auto-accept', () => {
      mockInterceptor.isCountdownActive.mockReturnValue(true);
      
      manager.setAutoAcceptEnabled(true);
      manager.toggleAutoAccept(); // This should disable and cancel countdown
      
      expect(mockInterceptor.cancelCurrentCountdown).toHaveBeenCalled();
    });
  });

  describe('processAutoAcceptAction', () => {
    it('should return false when auto-accept is disabled', async () => {
      const result = await manager.processAutoAcceptAction(
        'file-edit',
        'Test action',
        jest.fn()
      );

      expect(result).toBe(false);
      expect(mockInterceptor.interceptAction).not.toHaveBeenCalled();
    });

    it('should intercept action when auto-accept is enabled', async () => {
      manager.setAutoAcceptEnabled(true);
      mockInterceptor.interceptAction.mockResolvedValue(true);
      
      const executeFunction = jest.fn();
      const result = await manager.processAutoAcceptAction(
        'file-edit',
        'Test action',
        executeFunction,
        { test: 'metadata' }
      );

      expect(result).toBe(true);
      expect(mockInterceptor.interceptAction).toHaveBeenCalledWith({
        id: expect.stringMatching(/^file-edit-\d+$/),
        type: 'file-edit',
        description: 'Test action',
        execute: executeFunction,
        metadata: { test: 'metadata' }
      });
    });
  });

  describe('ESC context', () => {
    it('should provide correct ESC context', () => {
      manager.setAutoAcceptEnabled(true);
      mockInterceptor.isCountdownActive.mockReturnValue(true);
      
      const context = manager.getESCContext();
      
      expect(context).toMatchObject({
        timestamp: expect.any(Number),
        activeCountdown: true,
        transcriptMode: false,
        oauthFlow: false,
        autoAcceptEnabled: true
      });
    });
  });

  describe('original handler registration', () => {
    it('should register and store original handlers', () => {
      const handler = jest.fn();
      manager.registerOriginalHandler('file-edit', handler);
      
      expect((manager as any).originalAutoAcceptHandlers.get('file-edit')).toBe(handler);
    });
  });
});

describe('Factory functions', () => {
  it('should create complete auto-accept system', () => {
    const system = createAutoAcceptSystem();
    
    expect(system.interceptor).toBeInstanceOf(CountdownAutoAcceptInterceptor);
    expect(system.manager).toBeInstanceOf(AutoAcceptManager);
  });

  it('should provide global instances', () => {
    expect(globalAutoAcceptManager).toBeInstanceOf(AutoAcceptManager);
  });
});