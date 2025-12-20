const fs = require('fs');
const path = require('path');

// Log file path - accessible in Docker
const LOG_FILE = '/var/log/app.log';

// Ensure log directory exists
function ensureLogFile() {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    // Touch the file if it doesn't exist
    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '');
    }
  } catch (error) {
    console.error('Failed to ensure log file exists:', error);
  }
}

// Write to log file
function writeLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };

  const logLine = JSON.stringify(logEntry) + '\n';

  // Always log to console
  console.log(logLine.trim());

  // Try to write to file
  try {
    ensureLogFile();
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

module.exports = {
  info: (message, data) => writeLog('INFO', message, data),
  warn: (message, data) => writeLog('WARN', message, data),
  error: (message, data) => writeLog('ERROR', message, data),
  debug: (message, data) => writeLog('DEBUG', message, data),
  LOG_FILE
};
