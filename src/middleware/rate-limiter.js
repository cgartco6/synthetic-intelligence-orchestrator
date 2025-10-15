const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

class RateLimiter {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL);
        
        // General API rate limiting
        this.generalLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
            }
        });

        // Strict authentication rate limiting
        this.authLimiter = rateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // 5 login attempts per hour per IP
            message: {
                error: 'Too many login attempts, please try again later.',
                retryAfter: '1 hour'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true // Don't count successful attempts
        });

        // AI agent specific rate limiting
        this.agentLimiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: (req) => {
                // Different limits based on subscription tier
                const tierLimits = {
                    'free': 2,
                    'basic': 10,
                    'premium': 30,
                    'enterprise': 100
                };
                return tierLimits[req.user?.subscriptionTier] || tierLimits.free;
            },
            message: {
                error: 'Rate limit exceeded for AI agents',
                retryAfter: '1 minute'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => `agent:${req.user.id}`
        });

        // Payment endpoint rate limiting
        this.paymentLimiter = rateLimit({
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 10, // 10 payment attempts per 5 minutes
            message: {
                error: 'Too many payment attempts, please try again later.',
                retryAfter: '5 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Admin endpoint rate limiting
        this.adminLimiter = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 30, // 30 requests per minute for admin
            message: {
                error: 'Admin rate limit exceeded',
                retryAfter: '1 minute'
            },
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => `admin:${req.user.id}`
        });
    }

    createCustomLimiter(windowMs, maxRequests, keyGenerator = null) {
        return rateLimit({
            windowMs,
            max: maxRequests,
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: keyGenerator || ((req) => req.ip),
            handler: (req, res) => {
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    retryAfter: `${Math.ceil(windowMs / 1000)} seconds`,
                    limit: maxRequests,
                    window: `${windowMs / 1000} seconds`
                });
            }
        });
    }

    async checkCustomRateLimit(key, maxRequests, windowMs) {
        const current = await this.redis.get(key);
        
        if (current === null) {
            await this.redis.setex(key, windowMs / 1000, 1);
            return { allowed: true, remaining: maxRequests - 1 };
        }
        
        const currentCount = parseInt(current);
        
        if (currentCount >= maxRequests) {
            const ttl = await this.redis.ttl(key);
            return { 
                allowed: false, 
                remaining: 0,
                resetIn: ttl
            };
        }
        
        await this.redis.incr(key);
        return { 
            allowed: true, 
            remaining: maxRequests - currentCount - 1 
        };
    }

    async getRateLimitStatus(key) {
        const current = await this.redis.get(key);
        const ttl = await this.redis.ttl(key);
        
        return {
            current: current ? parseInt(current) : 0,
            ttl: ttl
        };
    }

    async resetRateLimit(key) {
        await this.redis.del(key);
    }

    async cleanup() {
        await this.redis.quit();
    }

    // Method to handle burst limits (more requests in shorter time)
    createBurstLimiter(maxBurst, windowMs) {
        return rateLimit({
            windowMs,
            max: maxBurst,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: 'Too many requests in short time, please slow down.',
                retryAfter: `${windowMs / 1000} seconds`
            }
        });
    }

    // Method for concurrent request limiting
    async checkConcurrentLimit(key, maxConcurrent) {
        const current = await this.redis.get(`concurrent:${key}`);
        
        if (current && parseInt(current) >= maxConcurrent) {
            return { allowed: false, current: parseInt(current) };
        }
        
        await this.redis.incr(`concurrent:${key}`);
        // Set expiration to prevent memory leaks (1 hour)
        await this.redis.expire(`concurrent:${key}`, 3600);
        
        return { allowed: true, current: (parseInt(current) || 0) + 1 };
    }

    async releaseConcurrentLimit(key) {
        await this.redis.decr(`concurrent:${key}`);
    }

    // Global rate limiting based on user tier
    getTierBasedLimiter() {
        return (req, res, next) => {
            const tier = req.user?.subscriptionTier || 'free';
            const limits = {
                'free': { windowMs: 60000, max: 10 },
                'basic': { windowMs: 60000, max: 30 },
                'premium': { windowMs: 60000, max: 60 },
                'enterprise': { windowMs: 60000, max: 100 }
            };

            const limit = limits[tier];
            const limiter = this.createCustomLimiter(
                limit.windowMs, 
                limit.max, 
                (req) => `tier:${req.user?.id || req.ip}`
            );

            limiter(req, res, next);
        };
    }
}

module.exports = new RateLimiter();
