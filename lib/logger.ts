import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  type: 'prompt' | 'response' | 'data' | 'error' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export function logToFile(entry: LogEntry) {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOG_DIR, `chat_${today}.txt`);

  const logLine = `[${entry.timestamp}] ${entry.type.toUpperCase()}: ${entry.content}\n`;
  const metadata = entry.metadata ? `  Metadata: ${JSON.stringify(entry.metadata)}\n` : '';

  fs.appendFileSync(logFile, logLine + metadata);
}

export function logPrompt(content: string, metadata?: Record<string, any>) {
  logToFile({
    timestamp: new Date().toISOString(),
    type: 'prompt',
    content,
    metadata,
  });
}

export function logResponse(content: string, metadata?: Record<string, any>) {
  logToFile({
    timestamp: new Date().toISOString(),
    type: 'response',
    content,
    metadata,
  });
}

export function logData(content: string, metadata?: Record<string, any>) {
  logToFile({
    timestamp: new Date().toISOString(),
    type: 'data',
    content,
    metadata,
  });
}

export function logError(content: string, metadata?: Record<string, any>) {
  logToFile({
    timestamp: new Date().toISOString(),
    type: 'error',
    content,
    metadata,
  });
}

export function logSystem(content: string, metadata?: Record<string, any>) {
  logToFile({
    timestamp: new Date().toISOString(),
    type: 'system',
    content,
    metadata,
  });
}
