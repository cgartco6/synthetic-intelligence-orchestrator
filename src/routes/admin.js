const express = require('express');
const router = express.Router();
const rateLimit = require('../middleware/rate-limiter');
const UserModel = require('../models/user');
const SubscriptionModel = require('../models/subscription');
const TaskModel = require('../models/task');
const AdCampaignModel = require('../models/ad-campaign');
const AuditLogger = require('../../security/audit-logger');
const GrowthTracker = require('../../marketing/analytics-tracker');

const userModel = new UserModel();
const subscriptionModel = new SubscriptionModel();
const taskModel = new TaskModel();
const adCampaignModel = new AdCampaignModel();
const auditLogger = new AuditLogger();
const growthTracker = new GrowthTracker();

// Apply admin rate limiting
router.use(rateLimit.adminLimiter);

// Require admin permissions for all routes
router.use(requireAdminPermissions);

// Dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const [
            userStats,
            subscriptionStats,
            taskStats,
            revenueStats,
            adStats
        ] = await Promise.all([
            getUserStatistics(),
            getSubscriptionStatistics(),
            getTaskStatistics(),
            getRevenueStatistics(),
            getAdStatistics()
        ]);

        const growthProgress = growthTracker.getProgress();

        res.json({
            success: true,
            dashboard: {
                userStats,
                subscriptionStats,
                taskStats,
                revenueStats,
                adStats,
                growthProgress
            }
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load dashboard'
        });
    }
});

// User management
router.get('/users', async (req, res) => {
    try {
        const { search, tier, country, page = 1, limit = 50 } = req.query;
        
        const criteria = {};
        if (search) criteria.email = search;
        if (tier) criteria.subscriptionTier = tier;
        if (country) criteria.country = country;

        const offset = (page - 1) * limit;
        const users = await userModel.searchUsers(criteria, parseInt(limit), offset);

        res.json({
            success: true,
            users: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: users.length
            }
        });

    } catch (error) {
        console.error('Admin get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get users'
        });
    }
});

router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await userModel.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userStats = await userModel.getUserStats(userId);
        const subscription = await subscriptionModel.getSubscriptionByUserId(userId);
        const recentTasks = await taskModel.getUserTasks(userId, 10);

        res.json({
            success: true,
            user: {
                ...user,
                stats: userStats,
                subscription: subscription,
                recentTasks: recentTasks
            }
        });

    } catch (error) {
        console.error('Admin get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user details'
        });
    }
});

router.put('/users/:userId/subscription', async (req, res) => {
    try {
        const { userId } = req.params;
        const { tier, status } = req.body;

        if (!tier) {
            return res.status(400).json({ error: 'Subscription tier is required' });
        }

        const success = await subscriptionModel.upgradeUserTier(userId, tier);

        if (success) {
            await auditLogger.logSecurityEvent({
                userId: req.user.id,
                action: 'ADMIN_SUBSCRIPTION_UPDATE',
                resource: 'ADMIN',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS',
                details: {
                    targetUserId: userId,
                    tier: tier,
                    status: status
                }
            });

            res.json({
                success: true,
                message: 'User subscription updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to update subscription'
            });
        }

    } catch (error) {
        console.error('Admin update subscription error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'ADMIN_SUBSCRIPTION_UPDATE',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: {
                targetUserId: req.params.userId,
                error: error.message
            }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to update subscription'
        });
    }
});

// Task management
router.get('/tasks', async (req, res) => {
    try {
        const { 
            userId, 
            taskType, 
            status, 
            startDate, 
            endDate,
            page = 1, 
            limit = 50 
        } = req.query;

        const criteria = {};
        if (userId) criteria.userId = userId;
        if (taskType) criteria.taskType = taskType;
        if (status) criteria.status = status;
        if (startDate) criteria.startDate = startDate;
        if (endDate) criteria.endDate = endDate;

        const offset = (page - 1) * limit;
        const tasks = await taskModel.searchTasks(criteria, parseInt(limit), offset);

        res.json({
            success: true,
            tasks: tasks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: tasks.length
            }
        });

    } catch (error) {
        console.error('Admin get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tasks'
        });
    }
});

// Ad campaign management
router.get('/ad-campaigns', async (req, res) => {
    try {
        const campaigns = await adCampaignModel.getActiveCampaigns();
        const performance = await adCampaignModel.getTopPerformingCampaigns();

        res.json({
            success: true,
            campaigns: campaigns,
            performance: performance
        });

    } catch (error) {
        console.error('Admin get ad campaigns error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ad campaigns'
        });
    }
});

router.post('/ad-campaigns', async (req, res) => {
    try {
        const campaignData = req.body;
        const campaign = await adCampaignModel.createCampaign(campaignData);

        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'ADMIN_CAMPAIGN_CREATE',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: { campaignId: campaign.id }
        });

        res.json({
            success: true,
            campaign: campaign
        });

    } catch (error) {
        console.error('Admin create campaign error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'ADMIN_CAMPAIGN_CREATE',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to create campaign'
        });
    }
});

// System analytics
router.get('/analytics', async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        const analytics = await getSystemAnalytics(period);

        res.json({
            success: true,
            analytics: analytics,
            period: period
        });

    } catch (error) {
        console.error('Admin get analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get analytics'
        });
    }
});

// Audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { userId, startDate, endDate, page = 1, limit = 100 } = req.query;

        const logs = await auditLogger.getAuditLogs(userId, startDate, endDate);

        // Paginate results
        const offset = (page - 1) * limit;
        const paginatedLogs = logs.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            logs: paginatedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: logs.length
            }
        });

    } catch (error) {
        console.error('Admin get audit logs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get audit logs'
        });
    }
});

// System maintenance
router.post('/maintenance/cleanup', async (req, res) => {
    try {
        const { days = 90 } = req.body;

        const deletedTasks = await taskModel.deleteOldTasks(days);

        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'SYSTEM_CLEANUP',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: { deletedTasks, days }
        });

        res.json({
            success: true,
            message: `Cleaned up ${deletedTasks} tasks older than ${days} days`
        });

    } catch (error) {
        console.error('Admin cleanup error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'SYSTEM_CLEANUP',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Cleanup failed'
        });
    }
});

router.post('/maintenance/reset-daily-counts', async (req, res) => {
    try {
        const resetCount = await userModel.resetDailyCounts();

        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'RESET_DAILY_COUNTS',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: { resetCount }
        });

        res.json({
            success: true,
            message: `Reset daily counts for ${resetCount} users`
        });

    } catch (error) {
        console.error('Admin reset daily counts error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'RESET_DAILY_COUNTS',
            resource: 'ADMIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to reset daily counts'
        });
    }
});

// Helper functions
function requireAdminPermissions(req, res, next) {
    if (!req.user || !req.user.permissions.includes('admin_access')) {
        return res.status(403).json({ 
            error: 'Administrator access required',
            required: 'admin_access',
            current: req.user?.permissions || []
        });
    }
    next();
}

async function getUserStatistics() {
    const totalUsers = await userModel.getActiveUserCount();
    const subscriptionDistribution = await userModel.getSubscriptionDistribution();
    
    return {
        totalUsers,
        subscriptionDistribution,
        newUsersToday: 0, // Would need to implement
        activeUsersToday: 0 // Would need to implement
    };
}

async function getSubscriptionStatistics() {
    const activeSubscriptions = await subscriptionModel.getActiveSubscriptionsCount();
    const mrr = await subscriptionModel.getMonthlyRecurringRevenue();
    const churnRate = await subscriptionModel.getChurnRate();
    
    return {
        activeSubscriptions,
        monthlyRecurringRevenue: mrr,
        churnRate
    };
}

async function getTaskStatistics() {
    const taskStats = await taskModel.getTaskStatistics(null, 7);
    const popularTasks = await taskModel.getPopularTaskTypes();
    const completionRate = await taskModel.getTaskCompletionRate();
    
    return {
        recentTasks: taskStats,
        popularTasks,
        completionRate
    };
}

async function getRevenueStatistics() {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                SUM(amount) as total_revenue,
                COUNT(*) as total_transactions,
                AVG(amount) as avg_transaction_value
             FROM payments 
             WHERE status = 'completed' 
             AND payment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        );

        const adRevenue = await taskModel.getAdRevenueByTier(30);

        return {
            totalRevenue: parseFloat(rows[0].total_revenue) || 0,
            totalTransactions: rows[0].total_transactions || 0,
            avgTransactionValue: parseFloat(rows[0].avg_transaction_value) || 0,
            adRevenue: adRevenue
        };
    } catch (error) {
        console.error('Error getting revenue statistics:', error);
        return {};
    }
}

async function getAdStatistics() {
    const campaigns = await adCampaignModel.getActiveCampaigns();
    const topCampaigns = await adCampaignModel.getTopPerformingCampaigns();
    const attentionCampaigns = await adCampaignModel.getCampaignsNeedingAttention();
    
    return {
        activeCampaigns: campaigns.length,
        topPerforming: topCampaigns,
        needsAttention: attentionCampaigns
    };
}

async function getSystemAnalytics(period) {
    // This would generate comprehensive analytics based on the period
    // For now, return basic metrics
    
    const days = period === '7d' ? 7 : 30;
    
    const [userGrowth, taskGrowth, revenueGrowth] = await Promise.all([
        getUserGrowth(days),
        getTaskGrowth(days),
        getRevenueGrowth(days)
    ]);

    return {
        userGrowth,
        taskGrowth,
        revenueGrowth,
        period: `${days} days`
    };
}

async function getUserGrowth(days) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as new_users
             FROM users 
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [days]
        );

        return rows;
    } catch (error) {
        console.error('Error getting user growth:', error);
        return [];
    }
}

async function getTaskGrowth(days) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                DATE(created_at) as date,
                COUNT(*) as task_count,
                SUM(ad_revenue) as daily_revenue
             FROM tasks 
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [days]
        );

        return rows;
    } catch (error) {
        console.error('Error getting task growth:', error);
        return [];
    }
}

async function getRevenueGrowth(days) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                DATE(payment_date) as date,
                SUM(amount) as daily_revenue
             FROM payments 
             WHERE status = 'completed'
             AND payment_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(payment_date)
             ORDER BY date`,
            [days]
        );

        return rows;
    } catch (error) {
        console.error('Error getting revenue growth:', error);
        return [];
    }
}

module.exports = router;
