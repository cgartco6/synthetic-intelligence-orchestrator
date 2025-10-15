module.exports = {
    // Ad serving configuration
    adServing: {
        enabled: true,
        defaultCPM: 50.00, // Fallback CPM
        minCPM: 10.00,
        maxCPM: 2200.00
    },

    // Ad frequency by subscription tier
    adFrequency: {
        free: {
            tasksPerAd: 2,
            maxAdsPerDay: 10,
            description: 'Ad every 2 tasks, max 10 ads daily'
        },
        basic: {
            tasksPerAd: 5,
            maxAdsPerDay: 8,
            description: 'Ad every 5 tasks, max 8 ads daily'
        },
        premium: {
            tasksPerAd: 200, // Effectively 1 ad per day
            maxAdsPerDay: 1,
            description: 'Only 1 high-paying ad daily'
        },
        enterprise: {
            tasksPerAd: 0,
            maxAdsPerDay: 0,
            description: 'No ads'
        }
    },

    // Ad categories and targeting
    categories: {
        luxury_tech: {
            baseCPM: 2200.00,
            targetTiers: ['free', 'basic', 'premium'],
            minBudget: 10000.00,
            requirements: ['high_production', 'brand_safety']
        },
        financial_services: {
            baseCPM: 1500.00,
            targetTiers: ['basic', 'premium'],
            minBudget: 15000.00,
            requirements: ['compliance', 'verified_advertiser']
        },
        ai_tools: {
            baseCPM: 800.00,
            targetTiers: ['free', 'basic', 'premium'],
            minBudget: 5000.00,
            requirements: ['relevance']
        },
        enterprise_saas: {
            baseCPM: 600.00,
            targetTiers: ['free', 'basic', 'premium'],
            minBudget: 20000.00,
            requirements: ['b2b_focus']
        }
    },

    // Geographic targeting multipliers
    geographicMultipliers: {
        'US': 1.3,
        'GB': 1.2,
        'EU': 1.1,
        'ZA': 1.0,
        'AU': 1.1,
        'CA': 1.1,
        'default': 0.8
    },

    // Time-based optimization
    timeOptimization: {
        timeOfDay: {
            '00-06': 0.8,  // Night
            '06-12': 1.2,  // Morning
            '12-18': 1.0,  // Afternoon
            '18-24': 1.1   // Evening
        },
        dayOfWeek: {
            '0': 0.9,  // Sunday
            '1': 1.0,  // Monday
            '2': 1.0,  // Tuesday
            '3': 1.0,  // Wednesday
            '4': 1.0,  // Thursday
            '5': 1.1,  // Friday
            '6': 1.2   // Saturday
        }
    },

    // Ad content requirements
    contentRequirements: {
        duration: {
            min: 15,  // seconds
            max: 30,  // seconds
            default: 30
        },
        formats: ['mp4', 'mov', 'avi'],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        aspectRatios: ['16:9', '1:1', '9:16'],
        quality: {
            minResolution: '720p',
            preferredResolution: '1080p'
        }
    },

    // Compliance and safety
    compliance: {
        contentModeration: true,
        brandSafety: true,
        adBlockingDetection: true,
        frequencyCapping: true,
        privacyCompliance: {
            gdpr: true,
            ccpa: true,
            popia: true
        }
    },

    // Performance optimization
    performance: {
        cacheDuration: 300, // 5 minutes
        preloadAds: true,
        lazyLoading: true,
        connectionOptimization: true
    },

    // Analytics and tracking
    analytics: {
        impressionTracking: true,
        completionTracking: true,
        conversionTracking: true,
        revenueTracking: true,
        realTimeReporting: true
    },

    // Fallback ads
    fallbackAds: {
        enabled: true,
        cpm: 50.00,
        content: {
            url: 'https://cdn.example.com/ads/fallback-ad.mp4',
            duration: 30,
            advertiser: 'AI Orchestrator Network'
        }
    }
};
