const { createLogger, transports, format } = require('winston');
const mysql = require('mysql2/promise');

class AuditLogger {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };

        this.logger = createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.File({ filename: 'logs/security.log' }),
                new transports.Console()
            ]
        });
    }

    async logSecurityEvent(event) {
        const {
            userId,
            action,
            resource,
            ipAddress,
            userAgent,
            status,
            details
        } = event;

        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            await connection.execute(
                `INSERT INTO security_audit_log 
                 (user_id, action, resource, ip_address, user_agent, status, details, timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [userId, action, resource, ipAddress, userAgent, status, JSON.stringify(details)]
            );

            this.logger.info('Security event logged', event);
        } catch (error) {
            this.logger.error('Failed to log security event', { error: error.message, event });
        } finally {
            await connection.end();
        }
    }

    async logLoginAttempt(userId, success, ipAddress, userAgent, reason = null) {
        await this.logSecurityEvent({
            userId,
            action: 'LOGIN_ATTEMPT',
            resource: 'AUTH',
            ipAddress,
            userAgent,
            status: success ? 'SUCCESS' : 'FAILED',
            details: { reason }
        });
    }

    async logPaymentEvent(userId, action, amount, currency, status, details = {}) {
        await this.logSecurityEvent({
            userId,
            action: `PAYMENT_${action.toUpperCase()}`,
            resource: 'PAYMENT',
            ipAddress: details.ipAddress || 'unknown',
            userAgent: details.userAgent || 'unknown',
            status: status.toUpperCase(),
            details: { amount, currency, ...details }
        });
    }

    async getAuditLogs(userId = null, startDate = null, endDate = null) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `SELECT * FROM security_audit_log WHERE 1=1`;
            const params = [];

            if (userId) {
                query += ` AND user_id = ?`;
                params.push(userId);
            }

            if (startDate) {
                query += ` AND timestamp >= ?`;
                params.push(startDate);
            }

            if (endDate) {
                query += ` AND timestamp <= ?`;
                params.push(endDate);
            }

            query += ` ORDER BY timestamp DESC LIMIT 1000`;

            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }
}

module.exports = AuditLogger;
