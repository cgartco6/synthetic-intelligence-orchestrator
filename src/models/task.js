const mysql = require('mysql2/promise');
const SecurityManager = require('../../security/encryption');

class TaskModel {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
        this.securityManager = new SecurityManager();
    }

    async createTask(taskData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const {
                id,
                userId,
                taskType,
                taskData: rawTaskData,
                resultData,
                status = 'completed',
                adServed = false,
                adCampaignId = null,
                adRevenue = 0
            } = taskData;

            // Encrypt sensitive task data
            const encryptedTaskData = this.securityManager.encrypt(JSON.stringify(rawTaskData));
            const encryptedResultData = resultData ? 
                this.securityManager.encrypt(JSON.stringify(resultData)) : null;

            const [result] = await connection.execute(
                `INSERT INTO tasks 
                 (id, user_id, task_type, task_data, result_data, status, 
                  ad_served, ad_campaign_id, ad_revenue, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [id, userId, taskType, encryptedTaskData, encryptedResultData, 
                 status, adServed, adCampaignId, adRevenue]
            );

            return {
                id,
                userId,
                taskType,
                status,
                adServed,
                adRevenue,
                createdAt: new Date()
            };

        } finally {
            await connection.end();
        }
    }

    async getTaskById(taskId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM tasks WHERE id = ?`,
                [taskId]
            );

            if (rows[0]) {
                // Decrypt task data
                const task = rows[0];
                task.task_data = JSON.parse(this.securityManager.decrypt(task.task_data));
                
                if (task.result_data) {
                    task.result_data = JSON.parse(this.securityManager.decrypt(task.result_data));
                }

                return task;
            }

            return null;
        } finally {
            await connection.end();
        }
    }

    async getUserTasks(userId, limit = 10, offset = 0) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT id, task_type, status, ad_served, ad_revenue, created_at
                 FROM tasks 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getTasksByType(taskType, limit = 50, offset = 0) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT t.*, u.email, u.subscription_tier
                 FROM tasks t
                 JOIN users u ON t.user_id = u.id
                 WHERE t.task_type = ? 
                 ORDER BY t.created_at DESC 
                 LIMIT ? OFFSET ?`,
                [taskType, limit, offset]
            );

            // Decrypt task data for each task
            const decryptedTasks = await Promise.all(
                rows.map(async (task) => {
                    try {
                        task.task_data = JSON.parse(this.securityManager.decrypt(task.task_data));
                        if (task.result_data) {
                            task.result_data = JSON.parse(this.securityManager.decrypt(task.result_data));
                        }
                    } catch (error) {
                        console.error('Error decrypting task data:', error);
                    }
                    return task;
                })
            );

            return decryptedTasks;
        } finally {
            await connection.end();
        }
    }

    async updateTaskStatus(taskId, status, resultData = null) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `UPDATE tasks SET status = ?`;
            const params = [status];

            if (resultData) {
                query += `, result_data = ?`;
                params.push(this.securityManager.encrypt(JSON.stringify(resultData)));
            }

            query += ` WHERE id = ?`;
            params.push(taskId);

            const [result] = await connection.execute(query, params);

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async getTaskStatistics(userId = null, days = 30) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `
                SELECT 
                    task_type,
                    COUNT(*) as total_tasks,
                    SUM(ad_revenue) as total_revenue,
                    AVG(ad_revenue) as avg_revenue_per_task,
                    SUM(CASE WHEN ad_served = 1 THEN 1 ELSE 0 END) as tasks_with_ads,
                    MIN(created_at) as first_task,
                    MAX(created_at) as last_task
                FROM tasks 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            `;
            const params = [days];

            if (userId) {
                query += ` AND user_id = ?`;
                params.push(userId);
            }

            query += ` GROUP BY task_type ORDER BY total_tasks DESC`;

            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    async getDailyTaskCount(userId = null, days = 7) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as task_count,
                    SUM(ad_revenue) as daily_revenue
                FROM tasks 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            `;
            const params = [days];

            if (userId) {
                query += ` AND user_id = ?`;
                params.push(userId);
            }

            query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            await connection.end();
        }
    }

    async getPopularTaskTypes(limit = 5) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    task_type,
                    COUNT(*) as usage_count,
                    COUNT(DISTINCT user_id) as unique_users
                 FROM tasks 
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 GROUP BY task_type 
                 ORDER BY usage_count DESC 
                 LIMIT ?`,
                [limit]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getTaskCompletionRate() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    task_type,
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                    CASE 
                        WHEN COUNT(*) > 0 THEN 
                            (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100
                        ELSE 0
                    END as completion_rate
                 FROM tasks 
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY task_type 
                 ORDER BY completion_rate DESC`
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getAdRevenueByTier(days = 30) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    u.subscription_tier,
                    COUNT(t.id) as total_tasks,
                    SUM(t.ad_revenue) as total_revenue,
                    AVG(t.ad_revenue) as avg_revenue_per_task
                 FROM tasks t
                 JOIN users u ON t.user_id = u.id
                 WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                 AND t.ad_served = 1
                 GROUP BY u.subscription_tier 
                 ORDER BY total_revenue DESC`,
                [days]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async searchTasks(searchCriteria, limit = 50, offset = 0) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            let query = `
                SELECT t.*, u.email, u.subscription_tier
                FROM tasks t
                JOIN users u ON t.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (searchCriteria.userId) {
                query += ` AND t.user_id = ?`;
                params.push(searchCriteria.userId);
            }

            if (searchCriteria.taskType) {
                query += ` AND t.task_type = ?`;
                params.push(searchCriteria.taskType);
            }

            if (searchCriteria.status) {
                query += ` AND t.status = ?`;
                params.push(searchCriteria.status);
            }

            if (searchCriteria.startDate) {
                query += ` AND t.created_at >= ?`;
                params.push(searchCriteria.startDate);
            }

            if (searchCriteria.endDate) {
                query += ` AND t.created_at <= ?`;
                params.push(searchCriteria.endDate);
            }

            if (searchCriteria.hasAds) {
                query += ` AND t.ad_served = 1`;
            }

            query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [rows] = await connection.execute(query, params);

            // Decrypt task data for each task
            const decryptedTasks = await Promise.all(
                rows.map(async (task) => {
                    try {
                        task.task_data = JSON.parse(this.securityManager.decrypt(task.task_data));
                        if (task.result_data) {
                            task.result_data = JSON.parse(this.securityManager.decrypt(task.result_data));
                        }
                    } catch (error) {
                        console.error('Error decrypting task data:', error);
                    }
                    return task;
                })
            );

            return decryptedTasks;
        } finally {
            await connection.end();
        }
    }

    async deleteOldTasks(days = 90) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `DELETE FROM tasks 
                 WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [days]
            );

            return result.affectedRows;
        } finally {
            await connection.end();
        }
    }

    async getTaskQueueStats() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(TIMESTAMPDIFF(SECOND, created_at, NOW())) as avg_wait_time_seconds
                 FROM tasks 
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 GROUP BY status`
            );

            return rows;
        } finally {
            await connection.end();
        }
    }
}

module.exports = TaskModel;
