import {
  CountdownESCHandler,
  ESCHandlerChain,
  TranscriptModeESCHandler,
  OAuthFlowESCHandler,
  globalESCHandlerChain,
  handleGlobalESC,
  setupCountdownESCIntegration,
  ESCContext
} from './esc-key-handler';

describe('CountdownESCHandler', () => {
  let handler: CountdownESCHandler;
  let cancelCallback: jest.MockedFunction<() => void>;

  beforeEach(() => {
    cancelCallback = jest.fn();
    handler = new CountdownESCHandler(cancelCallback);
  });

  it('should have high priority', () => {
    expect(handler.priority).toBe(100);
  });

  it('should handle ESC when countdown is active', () => {
    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: false,
      oauthFlow: false
    };

    expect(handler.canHandle(context)).toBe(true);
    expect(handler.handle(context)).toBe(true);
    expect(cancelCallback).toHaveBeenCalledTimes(1);
  });

  it('should not handle ESC when countdown is inactive', () => {
    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: false,
      oauthFlow: false
    };

    expect(handler.canHandle(context)).toBe(false);
    expect(handler.handle(context)).toBe(false);
    expect(cancelCallback).not.toHaveBeenCalled();
  });

  it('should allow setting cancel callback after construction', () => {
    const newCallback = jest.fn();
    handler.setCancelCallback(newCallback);

    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: false,
      oauthFlow: false
    };

    handler.handle(context);
    expect(newCallback).toHaveBeenCalledTimes(1);
    expect(cancelCallback).not.toHaveBeenCalled();
  });

  it('should return false if no callback is set', () => {
    const handlerNoCallback = new CountdownESCHandler();
    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: false,
      oauthFlow: false
    };

    expect(handlerNoCallback.handle(context)).toBe(false);
  });
});

describe('ESCHandlerChain', () => {
  let chain: ESCHandlerChain;

  beforeEach(() => {
    chain = new ESCHandlerChain();
  });

  it('should register countdown handler by default', () => {
    const handlers = chain.getHandlers();
    expect(handlers).toHaveLength(1);
    expect(handlers[0]).toBeInstanceOf(CountdownESCHandler);
  });

  it('should register handlers in priority order', () => {
    const lowPriorityHandler = new TranscriptModeESCHandler();
    const highPriorityHandler = new OAuthFlowESCHandler();
    
    chain.registerHandler(lowPriorityHandler);
    chain.registerHandler(highPriorityHandler);

    const handlers = chain.getHandlers();
    expect(handlers.map(h => h.priority)).toEqual([100, 75, 50]); // Countdown, OAuth, Transcript
  });

  it('should handle ESC with first matching handler', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    chain.registerHandler(new TranscriptModeESCHandler(callback1));
    chain.registerHandler(new OAuthFlowESCHandler(callback2));

    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: true,
      oauthFlow: true // Both are true, but transcript has higher priority in chain
    };

    const result = chain.handleESC(context);
    
    expect(result).toBe(true);
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled(); // Should not reach second handler
  });

  it('should return false if no handler processes ESC', () => {
    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: false,
      oauthFlow: false
    };

    const result = chain.handleESC(context);
    expect(result).toBe(false);
  });

  it('should allow setting countdown cancel callback', () => {
    const cancelCallback = jest.fn();
    chain.setCountdownCancelCallback(cancelCallback);

    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: false,
      oauthFlow: false
    };

    const result = chain.handleESC(context);
    expect(result).toBe(true);
    expect(cancelCallback).toHaveBeenCalledTimes(1);
  });

  it('should unregister handlers correctly', () => {
    const handler = new TranscriptModeESCHandler();
    chain.registerHandler(handler);
    
    expect(chain.getHandlers()).toHaveLength(2);
    
    chain.unregisterHandler(handler);
    expect(chain.getHandlers()).toHaveLength(1);
  });
});

describe('Legacy ESC Handlers', () => {
  describe('TranscriptModeESCHandler', () => {
    it('should handle ESC when transcript mode is active', () => {
      const exitCallback = jest.fn();
      const handler = new TranscriptModeESCHandler(exitCallback);

      const context: ESCContext = {
        timestamp: Date.now(),
        activeCountdown: false,
        transcriptMode: true,
        oauthFlow: false
      };

      expect(handler.canHandle(context)).toBe(true);
      expect(handler.handle(context)).toBe(true);
      expect(exitCallback).toHaveBeenCalledTimes(1);
    });

    it('should have medium priority', () => {
      const handler = new TranscriptModeESCHandler();
      expect(handler.priority).toBe(50);
    });
  });

  describe('OAuthFlowESCHandler', () => {
    it('should handle ESC when OAuth flow is active', () => {
      const cancelCallback = jest.fn();
      const handler = new OAuthFlowESCHandler(cancelCallback);

      const context: ESCContext = {
        timestamp: Date.now(),
        activeCountdown: false,
        transcriptMode: false,
        oauthFlow: true
      };

      expect(handler.canHandle(context)).toBe(true);
      expect(handler.handle(context)).toBe(true);
      expect(cancelCallback).toHaveBeenCalledTimes(1);
    });

    it('should have high-medium priority', () => {
      const handler = new OAuthFlowESCHandler();
      expect(handler.priority).toBe(75);
    });
  });
});

describe('Global ESC Integration', () => {
  beforeEach(() => {
    // Clear any existing handlers except the default countdown handler
    const handlers = globalESCHandlerChain.getHandlers().slice(1); // Keep first (countdown) handler
    handlers.forEach(handler => {
      globalESCHandlerChain.unregisterHandler(handler);
    });
  });

  it('should handle ESC through global function', () => {
    const cancelCallback = jest.fn();
    globalESCHandlerChain.setCountdownCancelCallback(cancelCallback);

    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: false,
      oauthFlow: false
    };

    const result = handleGlobalESC(context);
    expect(result).toBe(true);
    expect(cancelCallback).toHaveBeenCalledTimes(1);
  });

  it('should setup countdown ESC integration with existing handlers', () => {
    const countdownCancel = jest.fn();
    const exitTranscript = jest.fn();
    const cancelOAuth = jest.fn();

    setupCountdownESCIntegration(countdownCancel, {
      exitTranscript,
      cancelOAuth
    });

    // Test countdown priority (highest)
    let context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: true,
      transcriptMode: true,
      oauthFlow: true
    };

    let result = handleGlobalESC(context);
    expect(result).toBe(true);
    expect(countdownCancel).toHaveBeenCalledTimes(1);
    expect(exitTranscript).not.toHaveBeenCalled();
    expect(cancelOAuth).not.toHaveBeenCalled();

    // Test OAuth priority (second highest)
    context = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: true,
      oauthFlow: true
    };

    result = handleGlobalESC(context);
    expect(result).toBe(true);
    expect(cancelOAuth).toHaveBeenCalledTimes(1);
    expect(exitTranscript).not.toHaveBeenCalled();

    // Test transcript priority (lowest)
    context = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: true,
      oauthFlow: false
    };

    result = handleGlobalESC(context);
    expect(result).toBe(true);
    expect(exitTranscript).toHaveBeenCalledTimes(1);
  });

  it('should preserve existing ESC behavior when countdown is not active', () => {
    const exitTranscript = jest.fn();
    setupCountdownESCIntegration(() => {}, { exitTranscript });

    const context: ESCContext = {
      timestamp: Date.now(),
      activeCountdown: false,
      transcriptMode: true,
      oauthFlow: false
    };

    const result = handleGlobalESC(context);
    expect(result).toBe(true);
    expect(exitTranscript).toHaveBeenCalledTimes(1);
  });
});