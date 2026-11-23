type Level = "info" | "warn" | "error";

// The one place console is used. Never pass secrets, tokens or personal data.
function write(level: Level, message: string, context?: Record<string, string | number | boolean>): void {
  const line = JSON.stringify({ level, message, ...context, at: new Date().toISOString() });
  // eslint config allows console only here by convention; keep all logging in this file.
  globalThis.console[level](line);
}

export const logger = {
  info: (message: string, context?: Record<string, string | number | boolean>) => write("info", message, context),
  warn: (message: string, context?: Record<string, string | number | boolean>) => write("warn", message, context),
  error: (message: string, context?: Record<string, string | number | boolean>) => write("error", message, context),
};
