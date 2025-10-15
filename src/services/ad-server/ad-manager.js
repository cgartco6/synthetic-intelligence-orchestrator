const AdCampaignModel = require('../../models/ad-campaign');

class PremiumAdManager {
    constructor() {
        this.adCampaignModel = new AdCampaignModel();
        this.adFrequency = {
            'free': { tasksPerAd: 2, maxAdsPerDay: 10 },
            'basic': { tasksPerAd: 5, maxAdsPerDay: 8 },
            'premium': { tasksPerAd: 200, maxAdsPerDay: 1 },
            'enterprise': { tasksPerAd: 0, maxAdsPerDay: 0 }
        };
    }

    async serveAd(userId, userTier, userStats = {}) {
        try {
            // Check if we should serve an ad to this user
            if (!this.shouldServeAd(userTier, userStats)) {
                return { adRequired: false };
            }

            // Select the best ad for this user
            const ad = await this.selectAd(userTier);
            if (!ad) {
                return { adRequired: false };
            }

            // Track impression for billing
            const impressionId = await this.trackImpression(userId, ad);
            
            // Update user ad statistics
            await this.updateUserAdStats(userId, userStats.tasksCount || 0);

            return {
                adRequired: true,
                adContent: ad.content_url,
                duration: ad.duration,
                cpm: ad.cpm,
                campaignId: ad.id,
                requiresAttention: true,
                skipable: false,
                trackingId: impressionId
            };

        } catch (error) {
            console.error('Ad serving error:', error);
            return { adRequired: false };
        }
    }

    shouldServeAd(userTier, userStats) {
        const frequency = this.adFrequency[userTier];
        if (!frequency || frequency.tasksPerAd === 0) {
            return false;
        }

        const tasksSinceLastAd = (userStats.tasksCount || 0) - (userStats.lastAdTaskCount || 0);
        const adsToday = userStats.adsToday || 0;

        return tasksSinceLastAd >= frequency.tasksPerAd && 
               adsToday < frequency.maxAdsPerDay;
    }

    async selectAd(userTier) {
        try {
            // Get campaigns targeting this user tier
            const campaigns = await this.adCampaignModel.getCampaignsByAudience(userTier);
            
            if (campaigns.length === 0) {
                return await this.getFallbackAd();
            }

            // Filter active campaigns with budget remaining
            const availableCampaigns = campaigns.filter(campaign => 
                campaign.status === 'active' &&
                (campaign.budget === null || campaign.revenue < campaign.budget) &&
                (campaign.end_date === null || new Date(campaign.end_date) >= new Date())
            );

            if (availableCampaigns.length === 0) {
                return await this.getFallbackAd();
            }

            // Select campaign with highest CPM (for maximum revenue)
            const selectedCampaign = availableCampaigns.reduce((prev, current) => 
                (prev.cpm > current.cpm) ? prev : current
            );

            return selectedCampaign;

        } catch (error) {
            console.error('Ad selection error:', error);
            return await this.getFallbackAd();
        }
    }

    async getFallbackAd() {
        // Fallback ad with lower CPM but guaranteed availability
        return {
            id: 'fallback',
            content_url: 'https://cdn.example.com/ads/fallback-ad.mp4',
            duration: 30,
            cpm: 50.00,
            name: 'Fallback Ad',
            advertiser: 'AI Orchestrator'
        };
    }

    async trackImpression(userId, ad) {
        try {
            const revenue = ad.cpm / 1000; // CPM to per-impression revenue
            
            const impressionId = await this.adCampaignModel.recordImpression(
                ad.id, 
                userId, 
                revenue
            );

            console.log(`Ad impression tracked: user ${userId}, campaign ${ad.id}, revenue $${revenue}`);

            return impressionId;

        } catch (error) {
            console.error('Ad impression tracking error:', error);
            return `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }

    async updateUserAdStats(userId, currentTaskCount) {
        const db = require('../database/mysql-connector');
        
        try {
            await db.execute(
                `UPDATE users 
                 SET ads_today = COALESCE(ads_today, 0) + 1, 
                     total_ads = COALESCE(total_ads, 0) + 1,
                     last_ad_task_count = ?,
                     last_ad_date = CURDATE(),
                     updated_at = NOW()
                 WHERE id = ?`,
                [currentTaskCount, userId]
            );
        } catch (error) {
            console.error('Error updating user ad stats:', error);
        }
    }

    async getAdPerformanceReport(startDate = null, endDate = null) {
        try {
            if (!startDate) {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30); // Last 30 days
            }

            if (!endDate) {
                endDate = new Date();
            }

            const report = await this.adCampaignModel.getAdRevenueReport(startDate, endDate);

            // Calculate additional metrics
            const totalImpressions = report.reduce((sum, day) => sum + day.impressions, 0);
            const totalCompletions = report.reduce((sum, day) => sum + day.completions, 0);
            const totalRevenue = report.reduce((sum, day) => sum + parseFloat(day.revenue), 0);

            return {
                period: {
                    start: startDate,
                    end: endDate
                },
                summary: {
                    totalImpressions,
                    totalCompletions,
                    totalRevenue,
                    completionRate: totalImpressions > 0 ? (totalCompletions / totalImpressions) * 100 : 0,
                    effectiveCPM: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0
                },
                dailyBreakdown: report
            };

        } catch (error) {
            console.error('Ad performance report error:', error);
            throw error;
        }
    }

    async getActiveCampaigns() {
        try {
            return await this.adCampaignModel.getActiveCampaigns();
        } catch (error) {
            console.error('Error getting active campaigns:', error);
            return [];
        }
    }

    async createCampaign(campaignData) {
        try {
            return await this.adCampaignModel.createCampaign(campaignData);
        } catch (error) {
            console.error('Error creating campaign:', error);
            throw error;
        }
    }

    async updateCampaign(campaignId, updateData) {
        try {
            return await this.adCampaignModel.updateCampaign(campaignId, updateData);
        } catch (error) {
            console.error('Error updating campaign:', error);
            throw error;
        }
    }

    async getCampaignStatistics(campaignId) {
        try {
            return await this.adCampaignModel.getCampaignStatistics(campaignId);
        } catch (error) {
            console.error('Error getting campaign statistics:', error);
            throw error;
        }
    }

    // Method to optimize ad serving based on user behavior
    async optimizeAdServing(userId, userTier, userBehavior = {}) {
        // This could be enhanced with machine learning in the future
        // For now, use basic rules-based optimization
        
        const baseFrequency = this.adFrequency[userTier];
        let optimizedFrequency = { ...baseFrequency };

        // Adjust frequency based on user behavior
        if (userBehavior.avgSessionDuration > 300) { // If sessions are long
            optimizedFrequency.tasksPerAd = Math.max(1, baseFrequency.tasksPerAd - 1);
        }

        if (userBehavior.adCompletionRate > 0.8) { // If user completes ads frequently
            optimizedFrequency.maxAdsPerDay = Math.min(15, baseFrequency.maxAdsPerDay + 2);
        }

        return optimizedFrequency;
    }

    // Method to predict ad revenue
    async predictRevenue(timeframe = 'monthly') {
        try {
            const campaigns = await this.getActiveCampaigns();
            let predictedRevenue = 0;

            for (const campaign of campaigns) {
                const dailyImpressions = campaign.impressions / 30; // Average daily impressions
                const daysInTimeframe = timeframe === 'monthly' ? 30 : 7;
                const campaignRevenue = (campaign.cpm / 1000) * dailyImpressions * daysInTimeframe;
                
                // Consider budget constraints
                const remainingBudget = campaign.budget - campaign.revenue;
                predictedRevenue += Math.min(campaignRevenue, remainingBudget);
            }

            return predictedRevenue;
        } catch (error) {
            console.error('Revenue prediction error:', error);
            return 0;
        }
    }
}

module.exports = PremiumAdManager;
