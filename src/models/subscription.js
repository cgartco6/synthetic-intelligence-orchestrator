const mysql = require('mysql2/promise');

class SubscriptionModel {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };

        this.tiers = {
            'free': { price: 0, taskLimits: { text: 5, image: 1, code: 1, research: 1, analysis: 1, voice: 0 }},
            'basic': { price: 19, taskLimits: { text: 50, image: 10, code: 10, research: 10, analysis: 10, voice: 5 }},
            'premium': { price: 39, taskLimits: { text: 200, image: 50, code: 50, research: 50, analysis: 50, voice: 20 }},
            'enterprise': { price: 59, taskLimits: { text: -1, image: -1, code: -1, research: -1, analysis: -1, voice: -1 }}
        };
    }

    async createSubscription(subscriptionData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const {
                userId,
                tier,
                stripeSubscriptionId = null,
                payfastSubscriptionId = null,
                status = 'active',
                currentPeriodStart,
                currentPeriodEnd
            } = subscriptionData;

            const [result] = await connection.execute(
                `INSERT INTO subscriptions 
                 (user_id, tier, stripe_subscription_id, payfast_subscription_id, 
                  status, current_period_start, current_period_end, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [userId, tier, stripeSubscriptionId, payfastSubscriptionId, 
                 status, currentPeriodStart, currentPeriodEnd]
            );

            // Update user's subscription tier
            await connection.execute(
                `UPDATE users 
                 SET subscription_tier = ?, subscription_status = ?, updated_at = NOW() 
                 WHERE id = ?`,
                [tier, status, userId]
            );

            return {
                id: result.insertId,
                userId,
                tier,
                status,
                currentPeriodStart,
                currentPeriodEnd,
                createdAt: new Date()
            };

        } finally {
            await connection.end();
        }
    }

    async getSubscriptionById(subscriptionId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT s.*, u.email, u.first_name, u.last_name 
                 FROM subscriptions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.id = ?`,
                [subscriptionId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getSubscriptionByUserId(userId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM subscriptions 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getSubscriptionByStripeId(stripeSubscriptionId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT s.*, u.email, u.first_name, u.last_name 
                 FROM subscriptions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.stripe_subscription_id = ?`,
                [stripeSubscriptionId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getSubscriptionByPayfastId(payfastSubscriptionId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT s.*, u.email, u.first_name, u.last_name 
                 FROM subscriptions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.payfast_subscription_id = ?`,
                [payfastSubscriptionId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async updateSubscription(subscriptionId, updateData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const allowedFields = [
                'tier', 'status', 'stripe_subscription_id', 'payfast_subscription_id',
                'current_period_start', 'current_period_end'
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
            
            values.push(subscriptionId);
            
            const [result] = await connection.execute(
                `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // If tier or status changed, update user record
            if (updateData.tier || updateData.status) {
                const subscription = await this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    await connection.execute(
                        `UPDATE users 
                         SET subscription_tier = ?, subscription_status = ?, updated_at = NOW() 
                         WHERE id = ?`,
                        [updateData.tier || subscription.tier, 
                         updateData.status || subscription.status, 
                         subscription.user_id]
                    );
                }
            }

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const status = cancelAtPeriodEnd ? 'canceled' : 'inactive';
            
            const [result] = await connection.execute(
                `UPDATE subscriptions 
                 SET status = ?, updated_at = NOW() 
                 WHERE id = ?`,
                [status, subscriptionId]
            );

            // Update user status if immediate cancellation
            if (!cancelAtPeriodEnd) {
                const subscription = await this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    await connection.execute(
                        `UPDATE users 
                         SET subscription_status = 'canceled', updated_at = NOW() 
                         WHERE id = ?`,
                        [subscription.user_id]
                    );
                }
            }

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async reactivateSubscription(subscriptionId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE subscriptions 
                 SET status = 'active', updated_at = NOW() 
                 WHERE id = ?`,
                [subscriptionId]
            );

            // Update user status
            const subscription = await this.getSubscriptionById(subscriptionId);
            if (subscription) {
                await connection.execute(
                    `UPDATE users 
                     SET subscription_status = 'active', updated_at = NOW() 
                     WHERE id = ?`,
                    [subscription.user_id]
                );
            }

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async getExpiringSubscriptions(days = 7) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT s.*, u.email, u.first_name, u.last_name 
                 FROM subscriptions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.status = 'active' 
                 AND s.current_period_end BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)`,
                [days]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getActiveSubscriptionsCount() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT tier, COUNT(*) as count 
                 FROM subscriptions 
                 WHERE status = 'active' 
                 GROUP BY tier`
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getMonthlyRecurringRevenue() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT s.tier, COUNT(*) as count, 
                        SUM(COALESCE(p.amount, 0)) as revenue
                 FROM subscriptions s
                 LEFT JOIN payments p ON s.id = p.subscription_id 
                    AND p.status = 'completed'
                    AND p.payment_date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
                 WHERE s.status = 'active'
                 GROUP BY s.tier`
            );

            let totalMRR = 0;
            const breakdown = {};

            rows.forEach(row => {
                const tierRevenue = this.tiers[row.tier]?.price * row.count || 0;
                breakdown[row.tier] = {
                    count: row.count,
                    revenue: tierRevenue
                };
                totalMRR += tierRevenue;
            });

            return {
                total: totalMRR,
                breakdown: breakdown
            };
        } finally {
            await connection.end();
        }
    }

    async getChurnRate(days = 30) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Get total active subscriptions at start of period
            const [startActive] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM subscriptions 
                 WHERE status = 'active' 
                 AND created_at <= ?`,
                [startDate]
            );

            // Get cancellations during period
            const [cancellations] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM subscriptions 
                 WHERE status = 'canceled' 
                 AND updated_at BETWEEN ? AND NOW()`,
                [startDate]
            );

            const startCount = startActive[0].count;
            const churnedCount = cancellations[0].count;

            return {
                period: `${days} days`,
                startCount,
                churnedCount,
                churnRate: startCount > 0 ? (churnedCount / startCount) * 100 : 0
            };
        } finally {
            await connection.end();
        }
    }

    getTierInfo(tier) {
        return this.tiers[tier] || this.tiers.free;
    }

    getAllTiers() {
        return this.tiers;
    }

    async upgradeUserTier(userId, newTier) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            await connection.beginTransaction();

            try {
                // Get current subscription
                const currentSubscription = await this.getSubscriptionByUserId(userId);
                
                if (currentSubscription) {
                    // Update existing subscription
                    await this.updateSubscription(currentSubscription.id, {
                        tier: newTier,
                        status: 'active'
                    });
                } else {
                    // Create new subscription
                    await this.createSubscription({
                        userId,
                        tier: newTier,
                        status: 'active',
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                    });
                }

                await connection.commit();
                return true;
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        } finally {
            await connection.end();
        }
    }

    async downgradeUserTier(userId, newTier) {
        return await this.upgradeUserTier(userId, newTier);
    }
}

module.exports = SubscriptionModel;
