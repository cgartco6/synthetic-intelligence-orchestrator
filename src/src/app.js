const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('./middleware/rate-limiter');
const adMiddleware = require('./middleware/ad-middleware');
const authMiddleware = require('./middleware/auth');
const SecurityManager = require('../security/encryption');
const AuditLogger = require('../security/audit-logger');
const GrowthTracker = require('../marketing/analytics-tracker');

class AIOrchestratorApp {
    constructor() {
        this.app = express();
        this.securityManager = new SecurityManager();
        this.auditLogger = new AuditLogger();
        this.growthTracker = new GrowthTracker();
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeSecurity();
        this.startBackgroundJobs();
    }

    initializeMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.stripe.com", "https://api.openai.com"]
                }
            }
        }));

        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
            credentials: true
        }));

        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Rate limiting
        this.app.use(rateLimit.generalLimiter);

        // Authentication middleware for API routes
        this.app.use('/api', authMiddleware.verifyToken);

        // Ad middleware for agent routes
        this.app.use('/api/agents', adMiddleware.adMiddleware);
    }

    initializeRoutes() {
        // Public routes
        this.app.use('/api/auth', require('./routes/auth'));
        this.app.use('/api/public', require('./routes/public'));

        // Protected routes
        this.app.use('/api/agents', require('./routes/agents'));
        this.app.use('/api/subscription', require('./routes/subscription'));
        this.app.use('/api/payment', require('./routes/payment'));
        this.app.use('/api/user', require('./routes/user'));
        this.app.use('/api/admin', require('./routes/admin'));

        // Webhook routes (no auth required for webhooks)
        this.app.use('/webhooks/stripe', require('./routes/webhooks/stripe'));
        this.app.use('/webhooks/payfast', require('./routes/webhooks/payfast'));

        // Serve static files
        this.app.use(express.static('public'));

        // Error handling middleware
        this.app.use(this.errorHandler.bind(this));
    }

    initializeSecurity() {
        // Initialize security features
        this.app.use(this.securityAudit.bind(this));
        
        // CSRF protection for non-API routes
        this.app.use(this.csrfProtection.bind(this));
    }

    async securityAudit(req, res, next) {
        // Log security-relevant requests
        if (this.isSecurityRelevant(req)) {
            await this.auditLogger.logSecurityEvent({
                userId: req.user?.id || 'anonymous',
                action: req.method,
                resource: req.path,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'REQUEST',
                details: {
                    params: req.params,
                    query: req.query,
                    body: this.sanitizeLogData(req.body)
                }
            });
        }
        next();
    }

    csrfProtection(req, res, next) {
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !req.path.startsWith('/api')) {
            const csrfToken = req.headers['x-csrf-token'];
            if (!csrfToken || !this.securityManager.validateCSRFToken(csrfToken)) {
                return res.status(403).json({ error: 'CSRF token validation failed' });
            }
        }
        next();
    }

    errorHandler(err, req, res, next) {
        console.error('Application error:', err);

        // Log the error
        this.auditLogger.logSecurityEvent({
            userId: req.user?.id || 'anonymous',
            action: 'ERROR',
            resource: req.path,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'ERROR',
            details: {
                error: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            }
        });

        // Don't leak error details in production
        const message = process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message;

        res.status(err.status || 500).json({
            error: message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }

    isSecurityRelevant(req) {
        const securityPaths = ['/auth', '/payment', '/admin', '/webhooks'];
        return securityPaths.some(path => req.path.includes(path));
    }

    sanitizeLogData(data) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'cvv', 'number'];
        const sanitized = { ...data };
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '***REDACTED***';
            }
        });
        
        return sanitized;
    }

    startBackgroundJobs() {
        // Initialize growth tracking
        this.growthTracker.initialize();

        // Start social media auto-posting
        const SocialMediaAutoPoster = require('../marketing/social-poster');
        const socialPoster = new SocialMediaAutoPoster();
        socialPoster.startAutoPosting();

        // Monthly payout processing
        const cron = require('node-cron');
        cron.schedule('0 0 1 * *', async () => {
            console.log('Processing monthly payouts...');
            const PaymentDistributor = require('../payout/payment-distributor');
            const payoutDistributor = new PaymentDistributor();
            await payoutDistributor.processMonthlyPayout();
        });

        // Daily compliance checks
        cron.schedule('0 2 * * *', async () => {
            console.log('Running daily compliance checks...');
            const GDPRCompliance = require('../compliance/gdpr-compliance');
            const gdpr = new GDPRCompliance();
            await gdpr.processDataRetention();
        });
    }

    start(port = process.env.PORT || 3000) {
        this.server = this.app.listen(port, () => {
            console.log(`AI Orchestrator running on port ${port}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`Database: ${process.env.DB_HOST}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', this.gracefulShutdown.bind(this));
        process.on('SIGINT', this.gracefulShutdown.bind(this));

        return this.server;
    }

    async gracefulShutdown() {
        console.log('Received shutdown signal, closing server gracefully...');
        
        this.server.close(async () => {
            console.log('HTTP server closed');
            
            // Close database connections
            const db = require('./services/database/mysql-connector');
            await db.end();
            
            // Close Redis connections
            const rateLimiter = require('./middleware/rate-limiter');
            await rateLimiter.cleanup();
            
            console.log('All connections closed, exiting process');
            process.exit(0);
        });

        // Force close after 30 seconds
        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 30000);
    }
}

// Create and export app instance
const app = new AIOrchestratorApp();
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
    app.start();
}
