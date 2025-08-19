export interface StatusLineDisplay {
  showCountdown(remaining: number): void;
  showImmediate(): void;
  showCancelled(): void;
  showCompleted(): void;
  hide(): void;
  isVisible(): boolean;
  handleResize(): void;
}

export enum StatusDisplayState {
  HIDDEN = "hidden",
  COUNTDOWN = "countdown", 
  IMMEDIATE = "immediate",
  CANCELLED = "cancelled",
  COMPLETED = "completed"
}

export class TerminalStatusLineDisplay implements StatusLineDisplay {
  private state: StatusDisplayState = StatusDisplayState.HIDDEN;
  private currentLine: string = "";
  private readonly terminalWidth: number;
  
  constructor() {
    this.terminalWidth = process.stdout.columns || 80;
    this.setupResizeHandler();
  }

  showCountdown(remaining: number): void {
    this.state = StatusDisplayState.COUNTDOWN;
    const emoji = this.supportsEmoji() ? "⏳" : "[COUNTDOWN]";
    this.currentLine = `${emoji} Auto-accept in ${remaining}s (ESC to cancel)`;
    this.renderStatusLine();
  }

  showImmediate(): void {
    this.state = StatusDisplayState.IMMEDIATE;
    const emoji = this.supportsEmoji() ? "⚡" : "[IMMEDIATE]";
    this.currentLine = `${emoji} Auto-accept enabled (immediate)`;
    this.renderStatusLine();
  }

  showCancelled(): void {
    this.state = StatusDisplayState.CANCELLED;
    const emoji = this.supportsEmoji() ? "❌" : "[CANCELLED]";
    this.currentLine = `${emoji} Auto-accept cancelled`;
    this.renderStatusLine();
    
    // Auto-hide cancelled message after 2 seconds
    setTimeout(() => {
      if (this.state === StatusDisplayState.CANCELLED) {
        this.hide();
      }
    }, 2000);
  }

  showCompleted(): void {
    this.state = StatusDisplayState.COMPLETED;
    const emoji = this.supportsEmoji() ? "✅" : "[ACCEPTING]";
    this.currentLine = `${emoji} Auto-accepting...`;
    this.renderStatusLine();
    
    // Auto-hide completed message after 1 second
    setTimeout(() => {
      if (this.state === StatusDisplayState.COMPLETED) {
        this.hide();
      }
    }, 1000);
  }

  hide(): void {
    if (this.state !== StatusDisplayState.HIDDEN) {
      this.state = StatusDisplayState.HIDDEN;
      this.clearStatusLine();
    }
  }

  isVisible(): boolean {
    return this.state !== StatusDisplayState.HIDDEN;
  }

  handleResize(): void {
    if (this.isVisible()) {
      this.renderStatusLine();
    }
  }

  private renderStatusLine(): void {
    // Save cursor position
    process.stdout.write('\x1b[s');
    
    // Move to bottom-left corner (last row, column 1)
    const rows = process.stdout.rows || 24;
    process.stdout.write(`\x1b[${rows};1H`);
    
    // Clear the line and write status
    process.stdout.write('\x1b[2K'); // Clear entire line
    process.stdout.write(this.currentLine);
    
    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  private clearStatusLine(): void {
    // Save cursor position
    process.stdout.write('\x1b[s');
    
    // Move to bottom-left corner and clear line
    const rows = process.stdout.rows || 24;
    process.stdout.write(`\x1b[${rows};1H`);
    process.stdout.write('\x1b[2K');
    
    // Restore cursor position
    process.stdout.write('\x1b[u');
  }

  private supportsEmoji(): boolean {
    // Check if terminal supports emoji
    const term = process.env.TERM || "";
    const termProgram = process.env.TERM_PROGRAM || "";
    
    // Known emoji-supporting terminals
    const emojiTerminals = [
      "xterm-256color",
      "screen-256color", 
      "tmux-256color"
    ];
    
    const emojiPrograms = [
      "iTerm.app",
      "Apple_Terminal",
      "vscode"
    ];
    
    return emojiTerminals.includes(term) || 
           emojiPrograms.includes(termProgram) ||
           process.platform === "darwin"; // macOS generally supports emoji
  }

  private setupResizeHandler(): void {
    process.stdout.on('resize', () => {
      this.handleResize();
    });
  }
}