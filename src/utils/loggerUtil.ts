/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import winston from 'winston';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Define custom log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

// Custom colors for log levels
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'grey',
    debug: 'blue',
    silly: 'rainbow'
};

// Apply colors to Winston
winston.addColors(logColors);

// Determine log level from environment variable (default to 'info')
const getLogLevel = (): string => {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    const validLevels = Object.keys(logLevels);
    
    if (envLevel && validLevels.includes(envLevel)) {
        return envLevel;
    }
    
    // Default to 'http' in production (excludes verbose, debug and silly), 'debug' in development
    return process.env.NODE_ENV === 'production' ? 'http' : 'debug';
};

// Create custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        // Only stringify meta if it's a non-empty object
        let metaStr = '';
        if (meta && Object.keys(meta).length) {
            // Remove internal winston symbols if present
            const { [Symbol.for('splat')]: splat, ...rest } = meta;
            if (splat && Array.isArray(splat)) {
                metaStr = splat.map(item => typeof item === 'object' ? stringifyNoBigInt(item) : String(item)).join(' ');
            }
            if (Object.keys(rest).length) {
                metaStr += ' ' + stringifyNoBigInt(rest);
            }
            metaStr = metaStr.trim();
        }
        const serviceStr = service ? `[${service}]` : '';
        return `${timestamp} ${level} ${serviceStr}: ${message}${metaStr ? ' ' + metaStr : ''}`;
    })
);

// Create custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create transports array
const transports: winston.transport[] = [];

transports.push(
    new winston.transports.Console({
        format: consoleFormat,
        level: getLogLevel(),
        handleExceptions: false,
        handleRejections: false
    })
);

// Add file transports
const logsDir = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
try {
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
        console.log(`Created logs directory: ${logsDir}`);
    }
} catch (error) {
    console.error('Failed to create logs directory:', error);
}

// General application logs
transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'app.log'),
        format: fileFormat,
        level: getLogLevel(),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
        handleExceptions: false,
        handleRejections: false
    })
);

// Error logs only
transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        format: fileFormat,
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true,
        handleExceptions: false,
        handleRejections: false
    })
);

// Handle process events manually to ensure graceful shutdown
let isShuttingDown = false;

// Create the logger with safer configuration - NO exception/rejection handlers
const logger = winston.createLogger({
    levels: logLevels,
    level: getLogLevel(),
    format: fileFormat,
    defaultMeta: { service: 'discord-bot' },
    transports,
    exitOnError: false,
    // REMOVED: exceptionHandlers and rejectionHandlers to prevent conflicts
    silent: false
});

// Add error handling for the logger itself to prevent crashes
logger.on('error', (error) => {
    console.error('Logger error:', error);
});

// Export a function to safely close the logger
export const closeLogger = () => {
    if (!isShuttingDown) {
        isShuttingDown = true;
        logger.close();
    }
};

// REMOVED: All process event handlers from this file - they should only be in index.ts

// Debug logging configuration
console.log('Logger Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    logLevel: getLogLevel(),
    logsDir,
    transportCount: transports.length,
    logConsole: process.env.LOG_CONSOLE
});

// Test log to verify logger is working
logger.info('Logger initialized successfully', { 
    environment: process.env.NODE_ENV || 'development',
    level: getLogLevel()
});

// Helper functions for different logging contexts
export const createContextLogger = (context: string) => {
    return {
        error: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.error(message, meta && typeof meta === 'object' ? meta : { meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        warn: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.warn(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        info: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.info(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        http: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.http(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        verbose: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.verbose(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        debug: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.debug(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        },
        silly: (message: string, meta?: any) => {
            try {
                if (!isShuttingDown) logger.silly(message, { ...meta });
            } catch (err) {
                console.error('Logging error:', err);
            }
        }
    };
};

// Specialized loggers for different parts of the bot
export const discordLogger = createContextLogger('Discord');
export const playerLogger = createContextLogger('Player');
export const databaseLogger = createContextLogger('Database');
export const commandLogger = createContextLogger('Commands');
export const networkFileSerivceLogger = createContextLogger('NetworkFileService');
export const ytdlFallbackLogger = createContextLogger('YTDL-Fallback');
export const errorLogger = createContextLogger('Error');

// Log bot startup information
export const logBotStartup = () => {
    logger.info('Discord Bot Starting...', {
        nodeVersion: process.version,
        platform: process.platform,
        logLevel: getLogLevel(),
        environment: process.env.NODE_ENV || 'development'
    });
};

// Log Discord events
export const logDiscordEvent = (event: string, data?: any) => {
    discordLogger.info(`Discord Event: ${event}`, data);
};

// Log command usage
export const logCommandUsage = (command: string, userId: string, guildId?: string, success: boolean = true) => {
    commandLogger.info(`Command executed: ${command}`, {
        userId,
        guildId,
        success,
        timestamp: new Date().toISOString()
    });
};

// Log player events
export const logPlayerEvent = (event: string, guildId?: string, data?: any) => {
    playerLogger.info(`Player Event: ${event}`, {
        guildId,
        ...data
    });
};

// Log database operations
export const logDatabaseOperation = (operation: string, success: boolean, duration?: number, error?: Error) => {
    if (success) {
        databaseLogger.info(`Database operation: ${operation}`, { duration });
    } else {
        databaseLogger.error(`Database operation failed: ${operation}`, { error: error?.message, stack: error?.stack });
    }
};

// Log errors with context
export const logError = (error: Error, context?: string, additionalData?: any) => {
    try {
        if (!isShuttingDown) {
            errorLogger.error(`Error${context ? ` in ${context}` : ''}`, {
                message: error.message,
                stack: error.stack,
                name: error.name,
                ...additionalData
            });
        }
    } catch (logErr) {
        console.error('Failed to log error:', logErr);
        console.error('Original error:', error);
    }
};

// Performance logging
export const createPerformanceLogger = (operation: string) => {
    const start = Date.now();
    return {
        end: (success: boolean = true, data?: any) => {
            const duration = Date.now() - start;
            logger.verbose(`Performance: ${operation}`, {
                duration,
                success,
                ...data
            });
        }
    };
};

export const bigintReplacer = (_key: string, value: unknown) =>
typeof value === 'bigint' ? value.toString() : value;
// Helper to strip / convert BigInts deeply (optional if you always pass replacer)
function stringifyNoBigInt(obj: any) {
return JSON.stringify(obj, bigintReplacer, 2);
}

export default logger;