class GrowthTracker {
    constructor() {
        this.targets = {
            freeUsers: 10000,    // 10,000 free users in 2 weeks
            basicSubscriptions: 500,  // 500 basic in first month
            premiumSubscriptions: 50, // 50 premium in first month
            enterpriseSubscriptions: 20 // 20 enterprise in first month
        };
        
        this.currentStats = {
            freeUsers: 0,
            basicSubscriptions: 0,
            premiumSubscriptions: 0,
            enterpriseSubscriptions: 0,
            startDate: new Date()
        };
    }

    async trackUserSignup(user) {
        this.currentStats.freeUsers++;
        
        // Check if we hit free user target
        if (this.currentStats.freeUsers >= this.targets.freeUsers) {
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
        return {
            freeUsers: {
                current: this.currentStats.freeUsers,
                target: this.targets.freeUsers,
                percentage: (this.currentStats.freeUsers / this.targets.freeUsers * 100).toFixed(1)
            },
            basicSubscriptions: {
                current: this.currentStats.basicSubscriptions,
                target: this.targets.basicSubscriptions,
                percentage: (this.currentStats.basicSubscriptions / this.targets.basicSubscriptions * 100).toFixed(1)
            },
            premiumSubscriptions: {
                current: this.currentStats.premiumSubscriptions,
                target: this.targets.premiumSubscriptions,
                percentage: (this.currentStats.premiumSubscriptions / this.targets.premiumSubscriptions * 100).toFixed(1)
            },
            enterpriseSubscriptions: {
                current: this.currentStats.enterpriseSubscriptions,
                target: this.targets.enterpriseSubscriptions,
                percentage: (this.currentStats.enterpriseSubscriptions / this.targets.enterpriseSubscriptions * 100).toFixed(1)
            }
        };
    }

    async triggerMilestoneCelebration(milestone) {
        // Send notifications, create social media posts, etc.
        console.log(`🎉 Milestone achieved: ${milestone}`);
        
        // Auto-post celebration to social media
        const socialPoster = new SocialMediaAutoPoster();
        await socialPoster.postMilestoneCelebration(milestone, this.getProgress());
    }
}

module.exports = GrowthTracker;
