const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

class RateLimiter {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        
        this.generalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });

        this.authLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // 5 login attempts per hour
            message: 'Too many login attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        });

        this.apiLimiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 60, // 60 requests per minute
            message: 'Too many API requests, please slow down.',
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    async checkRateLimit(key, maxRequests, windowMs) {
        const current = await this.redis.get(key);
        
        if (current === null) {
            await this.redis.setex(key, windowMs / 1000, 1);
            return { allowed: true, remaining: maxRequests - 1 };
        }
        
        const currentCount = parseInt(current);
        
        if (currentCount >= maxRequests) {
            return { allowed: false, remaining: 0 };
        }
        
        await this.redis.incr(key);
        return { allowed: true, remaining: maxRequests - currentCount - 1 };
    }

    createCustomLimiter(maxRequests, windowMs) {
        return rateLimit({
            windowMs,
            max: maxRequests,
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    async cleanup() {
        await this.redis.quit();
    }
}

module.exports = RateLimiter;
