const winston = require('winston');
const path = require('path');

class Logger {
    constructor() {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'ai-orchestrator' },
            transports: [
                // Write all logs with importance level of `error` or less to `error.log`
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../../logs/error.log'), 
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Write all logs with importance level of `info` or less to `combined.log`
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../../logs/combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Console transport for development
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });

        // Create logs directory if it doesn't exist
        const fs = require('fs');
        const logsDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    log(level, message, meta = {}) {
        this.logger.log(level, message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    http(message, meta = {}) {
        this.log('http', message, meta);
    }

    verbose(message, meta = {}) {
        this.log('verbose', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    silly(message, meta = {}) {
        this.log('silly', message, meta);
    }

    // Method for logging API requests
    logAPIRequest(req, res, responseTime) {
        this.info('API Request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id || 'anonymous'
        });
    }

    // Method for logging security events
    logSecurityEvent(event) {
        this.warn('Security Event', event);
    }

    // Method for logging payment events
    logPaymentEvent(payment) {
        this.info('Payment Event', payment);
    }

    // Method for logging task processing
    logTaskProcessing(task) {
        this.info('Task Processing', task);
    }

    // Method for logging ad serving
    logAdServe(ad) {
        this.info('Ad Served', ad);
    }

    // Get log statistics
    async getLogStats(days = 7) {
        // This would analyze log files and return statistics
        // For now, return basic structure
        return {
            totalLogs: 0,
            errors: 0,
            warnings: 0,
            period: `${days} days`
        };
    }

    // Clean up old log files
    async cleanupOldLogs(days = 30) {
        const fs = require('fs');
        const path = require('path');
        const logsDir = path.join(__dirname, '../../logs');
        
        try {
            const files = fs.readdirSync(logsDir);
            const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
            
            files.forEach(file => {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    this.info(`Deleted old log file: ${file}`);
                }
            });
        } catch (error) {
            this.error('Error cleaning up old logs', { error: error.message });
        }
    }
}

// Create and export singleton instance
const logger = new Logger();
module.exports = logger;
