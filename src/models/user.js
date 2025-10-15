const mysql = require('mysql2/promise');
const SecurityManager = require('../../security/encryption');

class UserModel {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
        this.securityManager = new SecurityManager();
    }

    async createUser(userData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const {
                email,
                password,
                firstName,
                lastName,
                country,
                timezone,
                subscriptionTier = 'free'
            } = userData;

            // Validate required fields
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            // Check if user already exists
            const existingUser = await this.getUserByEmail(email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Hash password
            const hashedPassword = await this.securityManager.hashSensitiveData(password);

            // Insert user
            const [result] = await connection.execute(
                `INSERT INTO users 
                 (email, password_hash, first_name, last_name, country, timezone, subscription_tier, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [email, hashedPassword, firstName, lastName, country, timezone, subscriptionTier]
            );

            return {
                id: result.insertId,
                email,
                firstName,
                lastName,
                country,
                timezone,
                subscriptionTier,
                createdAt: new Date()
            };

        } finally {
            await connection.end();
        }
    }

    async getUserById(userId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT id, email, first_name, last_name, country, timezone, 
                        subscription_tier, subscription_status, tasks_today, 
                        ads_today, total_ads, created_at, updated_at
                 FROM users 
                 WHERE id = ?`,
                [userId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getUserByEmail(email) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT id, email, password_hash, first_name, last_name, country, timezone,
                        subscription_tier, subscription_status, tasks_today, ads_today,
                        created_at, updated_at
                 FROM users 
                 WHERE email = ?`,
                [email]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async updateUser(userId, updateData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const allowedFields = [
                'first_name', 'last_name', 'country', 'timezone', 
                'subscription_tier', 'subscription_status'
            ];
            
            const updates = [];
            const values = [];
            
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });
            
            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }
            
            updates.push('updated_at = NOW()');
            values.push(userId);
            
            const [result] = await connection.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async updateSubscription(userId, tier, status) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE users 
                 SET subscription_tier = ?, subscription_status = ?, updated_at = NOW() 
                 WHERE id = ?`,
                [tier, status, userId]
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async incrementTaskCount(userId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE users 
                 SET tasks_today = tasks_today + 1, 
                     updated_at = NOW() 
                 WHERE id = ?`,
                [userId]
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async resetDailyCounts() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE users 
                 SET tasks_today = 0, ads_today = 0 
                 WHERE DATE(updated_at) < CURDATE()`
            );

            return result.affectedRows;
        } finally {
            await connection.end();
        }
    }

    async getUserStats(userId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    u.tasks_today,
                    u.ads_today,
                    u.total_ads,
                    u.subscription_tier,
                    COUNT(t.id) as total_tasks,
                    SUM(CASE WHEN DATE(t.created_at) = CURDATE() THEN 1 ELSE 0 END) as today_tasks,
                    SUM(p.amount) as total_spent
                 FROM users u
                 LEFT JOIN tasks t ON u.id = t.user_id
                 LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'completed'
                 WHERE u.id = ?
                 GROUP BY u.id`,
                [userId]
            );

            return rows[0] || {};
        } finally {
            await connection.end();
        }
    }

    async searchUsers(criteria, limit = 50, offset = 0) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `
                SELECT id, email, first_name, last_name, country, subscription_tier, 
                       subscription_status, created_at
                FROM users 
                WHERE 1=1
            `;
            const params = [];

            if (criteria.email) {
                query += ` AND email LIKE ?`;
                params.push(`%${criteria.email}%`);
            }

            if (criteria.subscriptionTier) {
                query += ` AND subscription_tier = ?`;
                params.push(criteria.subscriptionTier);
            }

            if (criteria.country) {
                query += ` AND country = ?`;
                params.push(criteria.country);
            }

            if (criteria.createdAfter) {
                query += ` AND created_at >= ?`;
                params.push(criteria.createdAfter);
            }

            query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    async deleteUser(userId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            // Start transaction
            await connection.beginTransaction();

            try {
                // Delete user data from related tables (implement based on your schema)
                await connection.execute('DELETE FROM tasks WHERE user_id = ?', [userId]);
                await connection.execute('DELETE FROM payments WHERE user_id = ?', [userId]);
                await connection.execute('DELETE FROM ad_impressions WHERE user_id = ?', [userId]);
                
                // Finally delete the user
                const [result] = await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
                
                await connection.commit();
                return result.affectedRows > 0;
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } finally {
            await connection.end();
        }
    }

    async getActiveUserCount() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM users 
                 WHERE subscription_status = 'active' 
                 AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
            );

            return rows[0].count;
        } finally {
            await connection.end();
        }
    }

    async getSubscriptionDistribution() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT subscription_tier, COUNT(*) as count 
                 FROM users 
                 WHERE subscription_status = 'active' 
                 GROUP BY subscription_tier`
            );

            return rows;
        } finally {
            await connection.end();
        }
    }
}

module.exports = UserModel;
