export class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(prefix: string, enabled: boolean = true) {
    this.prefix = prefix;
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private formatMessage(message: string, level: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}`;
  }

  log(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.log(this.formatMessage(message, 'LOG'), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.formatMessage(message, 'INFO'), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.warn(this.formatMessage(message, 'WARN'), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.error(this.formatMessage(message, 'ERROR'), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.debug(this.formatMessage(message, 'DEBUG'), ...args);
    }
  }
}
