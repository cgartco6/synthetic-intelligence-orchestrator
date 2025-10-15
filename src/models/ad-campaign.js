const mysql = require('mysql2/promise');

class AdCampaignModel {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
    }

    async createCampaign(campaignData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const {
                name,
                advertiser,
                cpm,
                duration,
                targetAudience,
                contentUrl,
                startDate,
                endDate,
                budget,
                status = 'active'
            } = campaignData;

            const [result] = await connection.execute(
                `INSERT INTO ad_campaigns 
                 (name, advertiser, cpm, duration, target_audience, content_url, 
                  start_date, end_date, budget, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [name, advertiser, cpm, duration, JSON.stringify(targetAudience), 
                 contentUrl, startDate, endDate, budget, status]
            );

            return {
                id: result.insertId,
                ...campaignData,
                createdAt: new Date()
            };

        } finally {
            await connection.end();
        }
    }

    async getCampaignById(campaignId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM ad_campaigns WHERE id = ?`,
                [campaignId]
            );

            if (rows[0]) {
                rows[0].target_audience = JSON.parse(rows[0].target_audience);
            }

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getActiveCampaigns() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM ad_campaigns 
                 WHERE status = 'active' 
                 AND start_date <= NOW() 
                 AND (end_date IS NULL OR end_date >= NOW())`
            );

            return rows.map(row => ({
                ...row,
                target_audience: JSON.parse(row.target_audience)
            }));
        } finally {
            await connection.end();
        }
    }

    async getCampaignsByAudience(audienceTier) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT * FROM ad_campaigns 
                 WHERE status = 'active' 
                 AND start_date <= NOW() 
                 AND (end_date IS NULL OR end_date >= NOW())
                 AND JSON_CONTAINS(target_audience, ?)`,
                [JSON.stringify(audienceTier)]
            );

            return rows.map(row => ({
                ...row,
                target_audience: JSON.parse(row.target_audience)
            }));
        } finally {
            await connection.end();
        }
    }

    async updateCampaign(campaignId, updateData) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const allowedFields = [
                'name', 'advertiser', 'cpm', 'duration', 'target_audience',
                'content_url', 'start_date', 'end_date', 'budget', 'status'
            ];
            
            const updates = [];
            const values = [];
            
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    updates.push(`${key} = ?`);
                    if (key === 'target_audience') {
                        values.push(JSON.stringify(updateData[key]));
                    } else {
                        values.push(updateData[key]);
                    }
                }
            });
            
            if (updates.length === 0) {
                throw new Error('No valid fields to update');
            }
            
            values.push(campaignId);
            
            const [result] = await connection.execute(
                `UPDATE ad_campaigns SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async recordImpression(campaignId, userId, revenue) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `INSERT INTO ad_impressions 
                 (campaign_id, user_id, revenue, impression_date, created_at) 
                 VALUES (?, ?, ?, CURDATE(), NOW())`,
                [campaignId, userId, revenue]
            );

            // Update campaign statistics
            await connection.execute(
                `UPDATE ad_campaigns 
                 SET impressions = impressions + 1, 
                     revenue = revenue + ?,
                     updated_at = NOW()
                 WHERE id = ?`,
                [revenue, campaignId]
            );

            return result.insertId;
        } finally {
            await connection.end();
        }
    }

    async recordCompletion(impressionId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE ad_impressions 
                 SET completed = 1, completed_at = NOW() 
                 WHERE id = ?`,
                [impressionId]
            );

            // Update campaign completion rate
            await connection.execute(
                `UPDATE ad_campaigns 
                 SET completions = completions + 1,
                     updated_at = NOW()
                 WHERE id = (SELECT campaign_id FROM ad_impressions WHERE id = ?)`,
                [impressionId]
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async getCampaignPerformance(campaignId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    c.name,
                    c.advertiser,
                    c.cpm,
                    c.impressions,
                    c.completions,
                    c.revenue,
                    COUNT(ai.id) as total_impressions,
                    SUM(CASE WHEN ai.completed = 1 THEN 1 ELSE 0 END) as total_completions,
                    SUM(ai.revenue) as total_revenue,
                    CASE 
                        WHEN COUNT(ai.id) > 0 THEN 
                            SUM(CASE WHEN ai.completed = 1 THEN 1 ELSE 0 END) / COUNT(ai.id) * 100
                        ELSE 0
                    END as completion_rate
                 FROM ad_campaigns c
                 LEFT JOIN ad_impressions ai ON c.id = ai.campaign_id
                 WHERE c.id = ?
                 GROUP BY c.id`,
                [campaignId]
            );

            return rows[0] || null;
        } finally {
            await connection.end();
        }
    }

    async getAdRevenueReport(startDate, endDate) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    DATE(ai.impression_date) as date,
                    COUNT(ai.id) as impressions,
                    SUM(CASE WHEN ai.completed = 1 THEN 1 ELSE 0 END) as completions,
                    SUM(ai.revenue) as revenue,
                    AVG(c.cpm) as avg_cpm
                 FROM ad_impressions ai
                 JOIN ad_campaigns c ON ai.campaign_id = c.id
                 WHERE ai.impression_date BETWEEN ? AND ?
                 GROUP BY DATE(ai.impression_date)
                 ORDER BY date DESC`,
                [startDate, endDate]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getTopPerformingCampaigns(limit = 10) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    c.id,
                    c.name,
                    c.advertiser,
                    c.cpm,
                    c.impressions,
                    c.completions,
                    c.revenue,
                    CASE 
                        WHEN c.impressions > 0 THEN 
                            (c.completions / c.impressions) * 100
                        ELSE 0
                    END as completion_rate,
                    CASE 
                        WHEN c.impressions > 0 THEN 
                            (c.revenue / c.impressions) * 1000
                        ELSE 0
                    END as effective_cpm
                 FROM ad_campaigns c
                 WHERE c.status = 'active'
                 ORDER BY effective_cpm DESC
                 LIMIT ?`,
                [limit]
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async getCampaignsNeedingAttention() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    c.id,
                    c.name,
                    c.advertiser,
                    c.budget,
                    c.revenue,
                    c.impressions,
                    (c.budget - c.revenue) as remaining_budget,
                    DATEDIFF(c.end_date, NOW()) as days_remaining
                 FROM ad_campaigns c
                 WHERE c.status = 'active'
                 AND c.end_date IS NOT NULL
                 AND c.revenue < c.budget
                 AND DATEDIFF(c.end_date, NOW()) <= 7
                 ORDER BY days_remaining ASC`
            );

            return rows;
        } finally {
            await connection.end();
        }
    }

    async pauseCampaign(campaignId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE ad_campaigns 
                 SET status = 'paused', updated_at = NOW() 
                 WHERE id = ?`,
                [campaignId]
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async resumeCampaign(campaignId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [result] = await connection.execute(
                `UPDATE ad_campaigns 
                 SET status = 'active', updated_at = NOW() 
                 WHERE id = ?`,
                [campaignId]
            );

            return result.affectedRows > 0;
        } finally {
            await connection.end();
        }
    }

    async getCampaignStatistics(campaignId) {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            const [rows] = await connection.execute(
                `SELECT 
                    c.*,
                    COUNT(ai.id) as total_impressions,
                    SUM(CASE WHEN ai.completed = 1 THEN 1 ELSE 0 END) as total_completions,
                    SUM(ai.revenue) as total_revenue,
                    MIN(ai.impression_date) as first_impression,
                    MAX(ai.impression_date) as last_impression
                 FROM ad_campaigns c
                 LEFT JOIN ad_impressions ai ON c.id = ai.campaign_id
                 WHERE c.id = ?
                 GROUP BY c.id`,
                [campaignId]
            );

            const campaign = rows[0];
            if (!campaign) return null;

            // Calculate additional metrics
            const completionRate = campaign.total_impressions > 0 ? 
                (campaign.total_completions / campaign.total_impressions) * 100 : 0;
            
            const effectiveCPM = campaign.total_impressions > 0 ?
                (campaign.total_revenue / campaign.total_impressions) * 1000 : 0;

            return {
                ...campaign,
                completion_rate: completionRate,
                effective_cpm: effectiveCPM,
                budget_utilization: campaign.budget > 0 ? 
                    (campaign.total_revenue / campaign.budget) * 100 : 0
            };
        } finally {
            await connection.end();
        }
    }
}

module.exports = AdCampaignModel;
