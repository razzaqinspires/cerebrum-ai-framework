/**
 * @file src/core/logger.ts
 * @description Logger canggih berbasis Winston, dengan level kustom.
 */
import winston from 'winston';
import chalk from 'chalk';

// Definisikan level dan warna kustom kita
const myLevels = {
  error: 0,
  warn: 1,
  info: 2,
  success: 3, // Level kustom
  debug: 4,
};

const myColors = {
  error: 'redBG',
  warn: 'yellow',
  info: 'blue',
  success: 'green',
  debug: 'grey',
};

// Beritahu winston tentang warna kustom kita
winston.addColors(myColors);

// Buat tipe data Logger kita sendiri yang "mengenal" metode .success()
// Ini akan memperbaiki error TypeScript sebelumnya.
interface CustomLogger extends winston.Logger {
  success: (message: string, ...args: any[]) => CustomLogger;
}

const myFormat = winston.format.printf(({ level, message, timestamp, module, stack }) => {
  let logMessage = `${timestamp} [${module}] ${level}: ${message}`;
  if (stack) {
    logMessage += `\n${stack}`;
  }
  return logMessage;
});

export function createLogger(moduleName: string): CustomLogger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: myLevels, // Gunakan level kustom kita
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      myFormat
    ),
    defaultMeta: { module: moduleName },
    transports: [new winston.transports.Console()],
  }) as CustomLogger; // Casting ke tipe kustom kita
}

export type Logger = CustomLogger; // Ekspor tipe kustom kita