class CPMOptimizer {
    constructor() {
        this.historicalData = [];
        this.optimizationFactors = {
            timeOfDay: {
                '00-06': 0.8,  // Night - lower CPM
                '06-12': 1.2,  // Morning - higher CPM
                '12-18': 1.0,  // Afternoon - standard
                '18-24': 1.1   // Evening - slightly higher
            },
            dayOfWeek: {
                '0': 0.9,  // Sunday
                '1': 1.0,  // Monday
                '2': 1.0,  // Tuesday
                '3': 1.0,  // Wednesday
                '4': 1.0,  // Thursday
                '5': 1.1,  // Friday
                '6': 1.2   // Saturday
            },
            userTier: {
                'free': 1.0,
                'basic': 1.2,
                'premium': 1.5,
                'enterprise': 0.0
            },
            geographic: {
                'US': 1.3,
                'GB': 1.2,
                'EU': 1.1,
                'ZA': 1.0,
                'default': 0.8
            }
        };
    }

    calculateOptimalCPM(baseCPM, context) {
        let optimizedCPM = baseCPM;

        // Apply time-based optimization
        optimizedCPM *= this.getTimeOfDayFactor();
        
        // Apply day-of-week optimization
        optimizedCPM *= this.getDayOfWeekFactor();
        
        // Apply user tier optimization
        optimizedCPM *= this.getUserTierFactor(context.userTier);
        
        // Apply geographic optimization
        optimizedCPM *= this.getGeographicFactor(context.country);
        
        // Apply behavioral optimization
        optimizedCPM *= this.getBehavioralFactor(context.userBehavior);

        // Ensure CPM doesn't drop below minimum
        optimizedCPM = Math.max(optimizedCPM, baseCPM * 0.5);

        // Round to 2 decimal places
        return Math.round(optimizedCPM * 100) / 100;
    }

    getTimeOfDayFactor() {
        const hour = new Date().getHours();
        let timeSlot;
        
        if (hour >= 0 && hour < 6) timeSlot = '00-06';
        else if (hour >= 6 && hour < 12) timeSlot = '06-12';
        else if (hour >= 12 && hour < 18) timeSlot = '12-18';
        else timeSlot = '18-24';
        
        return this.optimizationFactors.timeOfDay[timeSlot] || 1.0;
    }

    getDayOfWeekFactor() {
        const day = new Date().getDay();
        return this.optimizationFactors.dayOfWeek[day.toString()] || 1.0;
    }

    getUserTierFactor(userTier) {
        return this.optimizationFactors.userTier[userTier] || 1.0;
    }

    getGeographicFactor(country) {
        return this.optimizationFactors.geographic[country] || 
               this.optimizationFactors.geographic.default;
    }

    getBehavioralFactor(userBehavior = {}) {
        let factor = 1.0;

        // Adjust based on user engagement
        if (userBehavior.adCompletionRate > 0.8) {
            factor *= 1.2; // High completion rate
        } else if (userBehavior.adCompletionRate < 0.3) {
            factor *= 0.8; // Low completion rate
        }

        // Adjust based on user value
        if (userBehavior.avgSessionDuration > 600) { // 10+ minutes
            factor *= 1.1;
        }

        // Adjust based on conversion likelihood
        if (userBehavior.taskCompletionRate > 0.7) {
            factor *= 1.15;
        }

        return factor;
    }

    async recordAdPerformance(adPerformance) {
        this.historicalData.push({
            timestamp: new Date(),
            ...adPerformance
        });

        // Keep only last 1000 records to prevent memory issues
        if (this.historicalData.length > 1000) {
            this.historicalData = this.historicalData.slice(-1000);
        }

        // Recalculate optimization factors periodically
        if (this.historicalData.length % 100 === 0) {
            await this.recalculateOptimizationFactors();
        }
    }

    async recalculateOptimizationFactors() {
        // This would analyze historical data to optimize factors
        // For now, we'll use preset factors
        console.log('Recalculating CPM optimization factors...');
        
        // In a real implementation, you would:
        // 1. Analyze which times/days have highest conversion rates
        // 2. Adjust factors based on actual performance data
        // 3. Implement machine learning for continuous optimization
    }

    getPerformanceMetrics(timeframe = '7d') {
        const cutoffDate = new Date();
        switch (timeframe) {
            case '24h':
                cutoffDate.setDate(cutoffDate.getDate() - 1);
                break;
            case '7d':
                cutoffDate.setDate(cutoffDate.getDate() - 7);
                break;
            case '30d':
                cutoffDate.setDate(cutoffDate.getDate() - 30);
                break;
            default:
                cutoffDate.setDate(cutoffDate.getDate() - 7);
        }

        const recentData = this.historicalData.filter(
            record => new Date(record.timestamp) >= cutoffDate
        );

        if (recentData.length === 0) {
            return {
                totalImpressions: 0,
                totalRevenue: 0,
                avgCPM: 0,
                completionRate: 0
            };
        }

        const totalImpressions = recentData.length;
        const totalRevenue = recentData.reduce((sum, record) => sum + record.revenue, 0);
        const completions = recentData.filter(record => record.completed).length;

        return {
            totalImpressions,
            totalRevenue,
            avgCPM: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0,
            completionRate: totalImpressions > 0 ? (completions / totalImpressions) * 100 : 0,
            timeframe
        };
    }

    predictOptimalCPM(context) {
        // Use historical data to predict optimal CPM for given context
        const similarContexts = this.historicalData.filter(record =>
            this.isSimilarContext(record.context, context)
        );

        if (similarContexts.length === 0) {
            return this.calculateOptimalCPM(50, context); // Default base CPM
        }

        // Calculate average effective CPM for similar contexts
        const totalRevenue = similarContexts.reduce((sum, record) => sum + record.revenue, 0);
        const totalImpressions = similarContexts.length;
        const avgEffectiveCPM = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 50;

        return this.calculateOptimalCPM(avgEffectiveCPM, context);
    }

    isSimilarContext(context1, context2) {
        // Simple similarity check - could be enhanced
        return context1.userTier === context2.userTier &&
               context1.country === context2.country &&
               Math.abs(this.getTimeDifference(context1.timestamp, context2.timestamp)) < 4; // Within 4 hours
    }

    getTimeDifference(timestamp1, timestamp2) {
        const date1 = new Date(timestamp1);
        const date2 = new Date(timestamp2);
        return Math.abs(date1 - date2) / (1000 * 60 * 60); // Difference in hours
    }
}

module.exports = CPMOptimizer;
