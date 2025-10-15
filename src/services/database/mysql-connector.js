const mysql = require('mysql2/promise');

class MySQLConnector {
    constructor() {
        this.pool = null;
        this.init();
    }

    init() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                acquireTimeout: 60000,
                timeout: 60000,
                reconnect: true
            });

            console.log('MySQL connection pool created successfully');
            
            // Test connection
            this.testConnection();
            
        } catch (error) {
            console.error('Failed to create MySQL connection pool:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            console.log('MySQL connection test successful');
            connection.release();
        } catch (error) {
            console.error('MySQL connection test failed:', error);
            throw error;
        }
    }

    async execute(query, params = []) {
        try {
            const [rows] = await this.pool.execute(query, params);
            return [rows];
        } catch (error) {
            console.error('MySQL query execution error:', error);
            console.error('Query:', query);
            console.error('Params:', params);
            throw error;
        }
    }

    async query(query, params = []) {
        try {
            const [rows] = await this.pool.query(query, params);
            return rows;
        } catch (error) {
            console.error('MySQL query error:', error);
            console.error('Query:', query);
            console.error('Params:', params);
            throw error;
        }
    }

    async getConnection() {
        try {
            return await this.pool.getConnection();
        } catch (error) {
            console.error('Failed to get MySQL connection:', error);
            throw error;
        }
    }

    async end() {
        try {
            if (this.pool) {
                await this.pool.end();
                console.log('MySQL connection pool closed');
            }
        } catch (error) {
            console.error('Error closing MySQL connection pool:', error);
            throw error;
        }
    }

    // Transaction support
    async beginTransaction() {
        const connection = await this.getConnection();
        await connection.beginTransaction();
        return connection;
    }

    async commitTransaction(connection) {
        await connection.commit();
        connection.release();
    }

    async rollbackTransaction(connection) {
        await connection.rollback();
        connection.release();
    }

    // Health check
    async healthCheck() {
        try {
            const [result] = await this.execute('SELECT 1 as health_check');
            return {
                healthy: true,
                database: 'MySQL',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                healthy: false,
                database: 'MySQL',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Database statistics
    async getDatabaseStats() {
        try {
            const [tableStats] = await this.execute(`
                SELECT 
                    TABLE_NAME as table_name,
                    TABLE_ROWS as row_count,
                    DATA_LENGTH as data_size,
                    INDEX_LENGTH as index_size
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = ?
                ORDER BY DATA_LENGTH + INDEX_LENGTH DESC
            `, [process.env.DB_NAME]);

            const [connectionStats] = await this.execute(`
                SHOW STATUS WHERE variable_name LIKE 'Threads_%'
            `);

            return {
                tables: tableStats,
                connections: connectionStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            throw error;
        }
    }

    // Backup helper (would need proper backup strategy)
    async createBackup() {
        // This is a simplified version
        // In production, you'd use mysqldump or similar tools
        console.log('Database backup initiated...');
        
        try {
            // Get all table data
            const tables = ['users', 'subscriptions', 'tasks', 'payments', 'ad_impressions', 'ad_campaigns'];
            const backup = {
                timestamp: new Date().toISOString(),
                tables: {}
            };

            for (const table of tables) {
                const [rows] = await this.execute(`SELECT * FROM ${table}`);
                backup.tables[table] = rows;
            }

            console.log('Database backup completed');
            return backup;
        } catch (error) {
            console.error('Database backup failed:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const db = new MySQLConnector();
module.exports = db;
