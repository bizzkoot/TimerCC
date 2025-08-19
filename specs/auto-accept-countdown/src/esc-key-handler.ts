export interface ESCHandler {
  priority: number;
  canHandle(context: ESCContext): boolean;
  handle(context: ESCContext): boolean; // Returns true if handled, false to continue chain
}

export interface ESCContext {
  timestamp: number;
  activeCountdown: boolean;
  transcriptMode: boolean;
  oauthFlow: boolean;
  [key: string]: any;
}

export class CountdownESCHandler implements ESCHandler {
  public readonly priority = 100; // High priority - handle before other ESC handlers
  private cancelCallback?: () => void;

  constructor(cancelCallback?: () => void) {
    this.cancelCallback = cancelCallback;
  }

  setCancelCallback(callback: () => void): void {
    this.cancelCallback = callback;
  }

  canHandle(context: ESCContext): boolean {
    return context.activeCountdown === true;
  }

  handle(context: ESCContext): boolean {
    if (!this.canHandle(context)) {
      return false;
    }

    if (this.cancelCallback) {
      this.cancelCallback();
      return true; // ESC handled - stop propagation to other handlers
    }

    return false; // Let other handlers process if no callback set
  }
}

export class ESCHandlerChain {
  private handlers: ESCHandler[] = [];
  private countdownHandler: CountdownESCHandler;

  constructor() {
    this.countdownHandler = new CountdownESCHandler();
    this.registerHandler(this.countdownHandler);
  }

  registerHandler(handler: ESCHandler): void {
    // Insert handler in priority order (highest first)
    const insertIndex = this.handlers.findIndex(h => h.priority < handler.priority);
    if (insertIndex === -1) {
      this.handlers.push(handler);
    } else {
      this.handlers.splice(insertIndex, 0, handler);
    }
  }

  unregisterHandler(handler: ESCHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  handleESC(context: ESCContext): boolean {
    for (const handler of this.handlers) {
      if (handler.canHandle(context) && handler.handle(context)) {
        return true; // Handler processed ESC, stop chain
      }
    }
    return false; // No handler processed ESC
  }

  setCountdownCancelCallback(callback: () => void): void {
    this.countdownHandler.setCancelCallback(callback);
  }

  getHandlers(): ReadonlyArray<ESCHandler> {
    return this.handlers;
  }
}

// Legacy ESC handlers for backward compatibility
export class TranscriptModeESCHandler implements ESCHandler {
  public readonly priority = 50;
  private exitTranscriptCallback?: () => void;

  constructor(exitCallback?: () => void) {
    this.exitTranscriptCallback = exitCallback;
  }

  canHandle(context: ESCContext): boolean {
    return context.transcriptMode === true;
  }

  handle(context: ESCContext): boolean {
    if (this.canHandle(context) && this.exitTranscriptCallback) {
      this.exitTranscriptCallback();
      return true;
    }
    return false;
  }
}

export class OAuthFlowESCHandler implements ESCHandler {
  public readonly priority = 75;
  private cancelOAuthCallback?: () => void;

  constructor(cancelCallback?: () => void) {
    this.cancelOAuthCallback = cancelCallback;
  }

  canHandle(context: ESCContext): boolean {
    return context.oauthFlow === true;
  }

  handle(context: ESCContext): boolean {
    if (this.canHandle(context) && this.cancelOAuthCallback) {
      this.cancelOAuthCallback();
      return true;
    }
    return false;
  }
}

// Global ESC handler chain instance
export const globalESCHandlerChain = new ESCHandlerChain();

// Convenience function for existing code integration
export function handleGlobalESC(context: ESCContext): boolean {
  return globalESCHandlerChain.handleESC(context);
}

// Setup function for integrating with existing keyboard handling
export function setupCountdownESCIntegration(
  countdownCancelCallback: () => void,
  existingHandlers: {
    exitTranscript?: () => void;
    cancelOAuth?: () => void;
  } = {}
): void {
  // Set countdown cancellation callback
  globalESCHandlerChain.setCountdownCancelCallback(countdownCancelCallback);
  
  // Register existing handlers for backward compatibility
  if (existingHandlers.exitTranscript) {
    globalESCHandlerChain.registerHandler(
      new TranscriptModeESCHandler(existingHandlers.exitTranscript)
    );
  }
  
  if (existingHandlers.cancelOAuth) {
    globalESCHandlerChain.registerHandler(
      new OAuthFlowESCHandler(existingHandlers.cancelOAuth)
    );
  }
}