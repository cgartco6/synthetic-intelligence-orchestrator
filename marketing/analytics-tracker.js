const mysql = require('mysql2/promise');
const axios = require('axios');

class GrowthTracker {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };

        this.targets = {
            freeUsers: 10000,
            basicSubscriptions: 500,
            premiumSubscriptions: 50,
            enterpriseSubscriptions: 20,
            timeframe: {
                freeUsers: 14, // days
                subscriptions: 30 // days
            }
        };
        
        this.currentStats = {
            freeUsers: 0,
            basicSubscriptions: 0,
            premiumSubscriptions: 0,
            enterpriseSubscriptions: 0,
            startDate: new Date(),
            dailyGrowth: []
        };
    }

    async initialize() {
        await this.loadCurrentStats();
        this.startDailyUpdate();
    }

    async loadCurrentStats() {
        const connection = await mysql.createConnection(this.dbConfig);
        
        try {
            // Get free users count
            const [freeUsers] = await connection.execute(
                "SELECT COUNT(*) as count FROM users WHERE subscription_tier = 'free'"
            );
            this.currentStats.freeUsers = freeUsers[0].count;

            // Get subscription counts
            const [basicSubs] = await connection.execute(
                "SELECT COUNT(*) as count FROM subscriptions WHERE tier = 'basic' AND status = 'active'"
            );
            this.currentStats.basicSubscriptions = basicSubs[0].count;

            const [premiumSubs] = await connection.execute(
                "SELECT COUNT(*) as count FROM subscriptions WHERE tier = 'premium' AND status = 'active'"
            );
            this.currentStats.premiumSubscriptions = premiumSubs[0].count;

            const [enterpriseSubs] = await connection.execute(
                "SELECT COUNT(*) as count FROM subscriptions WHERE tier = 'enterprise' AND status = 'active'"
            );
            this.currentStats.enterpriseSubscriptions = enterpriseSubs[0].count;

            console.log('Current stats loaded:', this.currentStats);
        } catch (error) {
            console.error('Error loading stats:', error);
        } finally {
            await connection.end();
        }
    }

    async trackUserSignup(user) {
        this.currentStats.freeUsers++;
        
        // Check free user target (14 days)
        const daysSinceStart = Math.floor((new Date() - this.currentStats.startDate) / (1000 * 60 * 60 * 24));
        const requiredDailyRate = this.targets.freeUsers / this.targets.timeframe.freeUsers;
        
        if (this.currentStats.freeUsers >= this.targets.freeUsers && daysSinceStart <= this.targets.timeframe.freeUsers) {
            await this.triggerMilestoneCelebration('free_users_target');
        }
        
        await this.updateDashboard();
    }

    async trackSubscription(subscription) {
        switch (subscription.tier) {
            case 'basic':
                this.currentStats.basicSubscriptions++;
                break;
            case 'premium':
                this.currentStats.premiumSubscriptions++;
                break;
            case 'enterprise':
                this.currentStats.enterpriseSubscriptions++;
                break;
        }

        // Check monthly targets
        if (this.isFirstMonth() && this.hasHitSubscriptionTargets()) {
            await this.triggerMilestoneCelebration('subscription_targets_met');
        }

        await this.updateDashboard();
    }

    hasHitSubscriptionTargets() {
        return (
            this.currentStats.basicSubscriptions >= this.targets.basicSubscriptions &&
            this.currentStats.premiumSubscriptions >= this.targets.premiumSubscriptions &&
            this.currentStats.enterpriseSubscriptions >= this.targets.enterpriseSubscriptions
        );
    }

    isFirstMonth() {
        const oneMonthLater = new Date(this.currentStats.startDate);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        return new Date() <= oneMonthLater;
    }

    getProgress() {
        const daysSinceStart = Math.max(1, Math.floor((new Date() - this.currentStats.startDate) / (1000 * 60 * 60 * 24)));
        
        return {
            freeUsers: {
                current: this.currentStats.freeUsers,
                target: this.targets.freeUsers,
                percentage: Math.min(100, (this.currentStats.freeUsers / this.targets.freeUsers * 100)).toFixed(1),
                dailyRate: (this.currentStats.freeUsers / daysSinceStart).toFixed(1),
                requiredRate: (this.targets.freeUsers / this.targets.timeframe.freeUsers).toFixed(1),
                onTrack: this.currentStats.freeUsers >= (this.targets.freeUsers / this.targets.timeframe.freeUsers) * daysSinceStart
            },
            basicSubscriptions: {
                current: this.currentStats.basicSubscriptions,
                target: this.targets.basicSubscriptions,
                percentage: Math.min(100, (this.currentStats.basicSubscriptions / this.targets.basicSubscriptions * 100)).toFixed(1),
                onTrack: this.currentStats.basicSubscriptions >= (this.targets.basicSubscriptions / this.targets.timeframe.subscriptions) * daysSinceStart
            },
            premiumSubscriptions: {
                current: this.currentStats.premiumSubscriptions,
                target: this.targets.premiumSubscriptions,
                percentage: Math.min(100, (this.currentStats.premiumSubscriptions / this.targets.premiumSubscriptions * 100)).toFixed(1),
                onTrack: this.currentStats.premiumSubscriptions >= (this.targets.premiumSubscriptions / this.targets.timeframe.subscriptions) * daysSinceStart
            },
            enterpriseSubscriptions: {
                current: this.currentStats.enterpriseSubscriptions,
                target: this.targets.enterpriseSubscriptions,
                percentage: Math.min(100, (this.currentStats.enterpriseSubscriptions / this.targets.enterpriseSubscriptions * 100)).toFixed(1),
                onTrack: this.currentStats.enterpriseSubscriptions >= (this.targets.enterpriseSubscriptions / this.targets.timeframe.subscriptions) * daysSinceStart
            },
            overall: {
                daysSinceStart,
                totalUsers: this.currentStats.freeUsers + this.currentStats.basicSubscriptions + this.currentStats.premiumSubscriptions + this.currentStats.enterpriseSubscriptions,
                totalSubscriptions: this.currentStats.basicSubscriptions + this.currentStats.premiumSubscriptions + this.currentStats.enterpriseSubscriptions,
                conversionRate: ((this.currentStats.basicSubscriptions + this.currentStats.premiumSubscriptions + this.currentStats.enterpriseSubscriptions) / this.currentStats.freeUsers * 100).toFixed(2)
            }
        };
    }

    async triggerMilestoneCelebration(milestone) {
        console.log(`🎉 Milestone achieved: ${milestone}`);
        
        const progress = this.getProgress();
        
        // Send notification to admin
        await this.sendAdminNotification(milestone, progress);
        
        // Auto-post celebration to social media
        const SocialMediaAutoPoster = require('./social-poster');
        const socialPoster = new SocialMediaAutoPoster();
        await socialPoster.postMilestoneCelebration(milestone, progress);
    }

    async sendAdminNotification(milestone, progress) {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
        
        if (webhookUrl) {
            try {
                await axios.post(webhookUrl, {
                    text: `🎉 *Milestone Achieved: ${milestone}*`,
                    attachments: [
                        {
                            color: 'good',
                            fields: [
                                {
                                    title: 'Free Users',
                                    value: `${progress.freeUsers.current}/${progress.freeUsers.target} (${progress.freeUsers.percentage}%)`,
                                    short: true
                                },
                                {
                                    title: 'Basic Subs',
                                    value: `${progress.basicSubscriptions.current}/${progress.basicSubscriptions.target} (${progress.basicSubscriptions.percentage}%)`,
                                    short: true
                                },
                                {
                                    title: 'Premium Subs',
                                    value: `${progress.premiumSubscriptions.current}/${progress.premiumSubscriptions.target} (${progress.premiumSubscriptions.percentage}%)`,
                                    short: true
                                },
                                {
                                    title: 'Enterprise Subs',
                                    value: `${progress.enterpriseSubscriptions.current}/${progress.enterpriseSubscriptions.target} (${progress.enterpriseSubscriptions.percentage}%)`,
                                    short: true
                                }
                            ]
                        }
                    ]
                });
            } catch (error) {
                console.error('Failed to send notification:', error);
            }
        }
    }

    startDailyUpdate() {
        // Update stats every hour
        setInterval(async () => {
            await this.loadCurrentStats();
            
            const progress = this.getProgress();
            console.log('Growth Progress Update:', progress);
            
            // Store daily snapshot
            this.currentStats.dailyGrowth.push({
                date: new Date().toISOString().split('T')[0],
                stats: { ...this.currentStats }
            });
            
            // Keep only last 30 days
            if (this.currentStats.dailyGrowth.length > 30) {
                this.currentStats.dailyGrowth.shift();
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    getGrowthForecast() {
        const progress = this.getProgress();
        const daysRemaining = {
            freeUsers: Math.max(0, this.targets.timeframe.freeUsers - progress.overall.daysSinceStart),
            subscriptions: Math.max(0, this.targets.timeframe.subscriptions - progress.overall.daysSinceStart)
        };

        return {
            freeUsers: {
                projected: Math.round(progress.freeUsers.current + (progress.freeUsers.dailyRate * daysRemaining.freeUsers)),
                target: this.targets.freeUsers,
                confidence: progress.freeUsers.onTrack ? 'high' : 'low'
            },
            basicSubscriptions: {
                projected: Math.round(progress.basicSubscriptions.current + (progress.basicSubscriptions.current / progress.overall.daysSinceStart) * daysRemaining.subscriptions),
                target: this.targets.basicSubscriptions,
                confidence: progress.basicSubscriptions.onTrack ? 'high' : 'low'
            },
            // Similar projections for other tiers...
        };
    }
}

module.exports = GrowthTracker;
