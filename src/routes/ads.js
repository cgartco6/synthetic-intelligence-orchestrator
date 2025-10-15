const express = require('express');
const router = express.Router();
const AdManager = require('../services/ad-server/ad-manager');
const adMiddleware = require('../middleware/ad-middleware');
const AuditLogger = require('../../security/audit-logger');

const adManager = new AdManager();
const auditLogger = new AuditLogger();

// Track ad completion
router.post('/complete', adMiddleware.trackAdCompletion);

// Serve premium ads
router.get('/premium', async (req, res) => {
    try {
        const user = req.user;
        const userTier = user?.subscriptionTier || 'free';

        // Get user statistics
        const userStats = await getUserStats(user?.id);
        
        const adResult = await adManager.serveAd(user?.id, userTier, userStats);

        if (!adResult.adRequired) {
            return res.status(404).json({
                success: false,
                error: 'No ad available at this time'
            });
        }

        await auditLogger.logSecurityEvent({
            userId: user?.id,
            action: 'AD_SERVED',
            resource: 'ADS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: {
                campaignId: adResult.campaignId,
                cpm: adResult.cpm,
                duration: adResult.duration
            }
        });

        res.json({
            success: true,
            ad: adResult
        });

    } catch (error) {
        console.error('Serve premium ad error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user?.id,
            action: 'AD_SERVED',
            resource: 'ADS',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to serve ad'
        });
    }
});

// Ad statistics for users
router.get('/stats', async (req, res) => {
    try {
        const user = req.user;

        const adStats = await getUserAdStats(user.id);

        res.json({
            success: true,
            stats: adStats
        });

    } catch (error) {
        console.error('Get ad stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ad statistics'
        });
    }
});

// Admin endpoints for ad management
router.get('/admin/campaigns', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user || !req.user.permissions.includes('admin_access')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const campaigns = await adManager.getActiveCampaigns();

        res.json({
            success: true,
            campaigns: campaigns
        });

    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get campaigns'
        });
    }
});

router.post('/admin/campaigns', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user || !req.user.permissions.includes('admin_access')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const campaignData = req.body;
        const campaign = await adManager.createCampaign(campaignData);

        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'CAMPAIGN_CREATED',
            resource: 'ADS',
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
        console.error('Create campaign error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'CAMPAIGN_CREATED',
            resource: 'ADS',
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

router.get('/admin/performance', async (req, res) => {
    try {
        // Check admin permissions
        if (!req.user || !req.user.permissions.includes('admin_access')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { startDate, endDate } = req.query;
        const performance = await adManager.getAdPerformanceReport(startDate, endDate);

        res.json({
            success: true,
            performance: performance
        });

    } catch (error) {
        console.error('Get ad performance error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ad performance'
        });
    }
});

// Helper functions
async function getUserStats(userId) {
    if (!userId) return {};
    
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT tasks_today, ads_today, last_ad_task_count 
             FROM users 
             WHERE id = ?`,
            [userId]
        );
        
        return rows[0] || {};
    } catch (error) {
        console.error('Error getting user stats:', error);
        return {};
    }
}

async function getUserAdStats(userId) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                COUNT(*) as total_ads,
                SUM(revenue) as total_revenue,
                AVG(revenue) as avg_revenue_per_ad,
                MIN(impression_date) as first_ad,
                MAX(impression_date) as last_ad
             FROM ad_impressions 
             WHERE user_id = ?`,
            [userId]
        );

        const [todayRows] = await db.execute(
            `SELECT COUNT(*) as ads_today 
             FROM ad_impressions 
             WHERE user_id = ? 
             AND impression_date = CURDATE()`,
            [userId]
        );

        return {
            ...rows[0],
            ads_today: todayRows[0]?.ads_today || 0
        };
    } catch (error) {
        console.error('Error getting user ad stats:', error);
        return {};
    }
}

module.exports = router;
