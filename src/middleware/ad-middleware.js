const AdManager = require('../services/ad-server/ad-manager');
const adManager = new AdManager();

async function adMiddleware(req, res, next) {
    // Skip ad checks for certain paths
    if (this.shouldSkipAdCheck(req)) {
        req.adServed = false;
        return next();
    }

    const user = req.user;
    const userTier = user?.subscriptionTier || 'free';
    
    // Skip ad check for enterprise users
    if (userTier === 'enterprise') {
        req.adServed = false;
        return next();
    }

    try {
        // Get user statistics for ad frequency calculation
        const userStats = await this.getUserStats(user?.id);
        
        const adResult = await adManager.serveAd(user?.id, userTier, userStats);
        
        if (adResult.adRequired) {
            // Store ad data in request for later use
            req.requiredAd = adResult;
            req.adServed = true;
            
            // Log ad serving for analytics
            await this.logAdServe(user?.id, adResult);
        } else {
            req.adServed = false;
        }
    } catch (error) {
        console.error('Ad middleware error:', error);
        req.adServed = false;
    }

    next();
}

function shouldSkipAdCheck(req) {
    const skipPaths = [
        '/api/auth',
        '/api/payment',
        '/api/admin',
        '/webhooks',
        '/health'
    ];

    return skipPaths.some(path => req.path.startsWith(path));
}

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

async function logAdServe(userId, adResult) {
    const db = require('../services/database/mysql-connector');
    
    try {
        await db.execute(
            `INSERT INTO ad_impressions 
             (user_id, campaign_id, revenue, impression_date) 
             VALUES (?, ?, ?, CURDATE())`,
            [userId, adResult.campaignId, adResult.cpm / 1000]
        );

        // Update user's ad stats
        await db.execute(
            `UPDATE users 
             SET ads_today = ads_today + 1, 
                 total_ads = total_ads + 1,
                 last_ad_task_count = tasks_today
             WHERE id = ?`,
            [userId]
        );
    } catch (error) {
        console.error('Error logging ad impression:', error);
    }
}

// Separate middleware to inject ad before response
function injectAdResponse(req, res, next) {
    if (req.adServed && req.requiredAd) {
        // For API responses, include ad information
        const originalJson = res.json;
        res.json = function(data) {
            if (data && typeof data === 'object') {
                data.adRequired = true;
                data.adData = {
                    ...req.requiredAd,
                    trackingId: req.requiredAd.trackingId || `ad_${Date.now()}`
                };
            }
            originalJson.call(this, data);
        };

        // For HTML responses, inject ad script
        const originalSend = res.send;
        res.send = function(data) {
            if (typeof data === 'string' && data.includes('</body>')) {
                const adScript = `
                    <div id="ad-container" data-ad-id="${req.requiredAd.trackingId}">
                        <video id="ad-video" src="${req.requiredAd.adContent}" controls></video>
                    </div>
                    <script>
                        // Ad tracking and completion logic
                        document.getElementById('ad-video').addEventListener('ended', function() {
                            fetch('/api/ads/complete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ trackingId: '${req.requiredAd.trackingId}' })
                            });
                        });
                    </script>
                `;
                data = data.replace('</body>', `${adScript}</body>`);
            }
            originalSend.call(this, data);
        };
    }
    next();
}

// Middleware to track ad completion
async function trackAdCompletion(req, res, next) {
    const { trackingId } = req.body;
    const userId = req.user?.id;

    if (!trackingId) {
        return res.status(400).json({ error: 'Tracking ID required' });
    }

    try {
        const db = require('../services/database/mysql-connector');
        
        await db.execute(
            `UPDATE ad_impressions 
             SET completed = 1, completed_at = NOW() 
             WHERE tracking_id = ? AND user_id = ?`,
            [trackingId, userId]
        );

        res.json({ success: true, message: 'Ad completion tracked' });
    } catch (error) {
        console.error('Error tracking ad completion:', error);
        res.status(500).json({ error: 'Failed to track ad completion' });
    }
}

// Middleware to check if user can skip ad (based on subscription)
function canSkipAd(req, res, next) {
    const userTier = req.user?.subscriptionTier || 'free';
    
    if (userTier === 'premium' || userTier === 'enterprise') {
        req.canSkipAd = true;
    } else {
        req.canSkipAd = false;
    }
    
    next();
}

module.exports = {
    adMiddleware,
    injectAdResponse,
    trackAdCompletion,
    canSkipAd
};
