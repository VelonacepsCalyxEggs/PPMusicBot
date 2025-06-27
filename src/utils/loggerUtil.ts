import winston from 'winston';
import path from 'path';

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
    
    // Default to 'info' in production, 'debug' in development
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

// Create custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        const serviceStr = service ? `[${service}]` : '';
        return `${timestamp} ${level} ${serviceStr}: ${message} ${metaStr}`;
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

// Add console transport if not in production or if explicitly enabled
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
            level: getLogLevel()
        })
    );
}

// Add file transports
const logsDir = path.join(process.cwd(), 'logs');

// General application logs
transports.push(
    new winston.transports.File({
        filename: path.join(logsDir, 'app.log'),
        format: fileFormat,
        level: getLogLevel(),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        tailable: true
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
        tailable: true
    })
);

// Create the logger
const logger = winston.createLogger({
    levels: logLevels,
    level: getLogLevel(),
    format: fileFormat,
    defaultMeta: { service: 'discord-bot' },
    transports,
    exitOnError: false,
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 3,
            tailable: true
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 3,
            tailable: true
        })
    ]
});

// Helper functions for different logging contexts
export const createContextLogger = (context: string) => {
    return {
        // Removed the context for now, as I don't like how cluttered it looks
        error: (message: string, meta?: any) => logger.error(message, { ...meta }),
        warn: (message: string, meta?: any) => logger.warn(message, { ...meta }),
        info: (message: string, meta?: any) => logger.info(message, { ...meta }),
        http: (message: string, meta?: any) => logger.http(message, { ...meta }),
        verbose: (message: string, meta?: any) => logger.verbose(message, { ...meta }),
        debug: (message: string, meta?: any) => logger.debug(message, { ...meta }),
        silly: (message: string, meta?: any) => logger.silly(message, { ...meta })
    };
};

// Specialized loggers for different parts of the bot
export const discordLogger = createContextLogger('Discord');
export const playerLogger = createContextLogger('Player');
export const databaseLogger = createContextLogger('Database');
export const commandLogger = createContextLogger('Commands');
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
    errorLogger.error(`Error${context ? ` in ${context}` : ''}`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...additionalData
    });
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

export default logger;