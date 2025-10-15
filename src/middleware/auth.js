const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SecurityManager = require('../../security/encryption');
const AuditLogger = require('../../security/audit-logger');

class AuthMiddleware {
    constructor() {
        this.securityManager = new SecurityManager();
        this.auditLogger = new AuditLogger();
        this.jwtSecret = process.env.JWT_SECRET;
        this.tokenExpiry = '7d';
    }

    async verifyToken(req, res, next) {
        const token = this.extractToken(req);
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            req.user = decoded;
            
            // Log successful authentication
            await this.auditLogger.logSecurityEvent({
                userId: decoded.id,
                action: 'API_ACCESS',
                resource: req.path,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS'
            });
            
            next();
        } catch (error) {
            // Log failed authentication
            await this.auditLogger.logSecurityEvent({
                userId: 'unknown',
                action: 'API_ACCESS',
                resource: req.path,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'FAILED',
                details: { error: 'Invalid token' }
            });
            
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }

    extractToken(req) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        
        return req.query.token || req.cookies?.token;
    }

    async generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            subscriptionTier: user.subscriptionTier,
            permissions: this.getUserPermissions(user.subscriptionTier)
        };

        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiry });
    }

    getUserPermissions(subscriptionTier) {
        const permissions = {
            'free': ['basic_access', 'limited_tasks'],
            'basic': ['basic_access', 'standard_tasks', 'reduced_ads'],
            'premium': ['full_access', 'premium_tasks', 'minimal_ads', 'priority_support'],
            'enterprise': ['full_access', 'unlimited_tasks', 'no_ads', 'premium_support', 'api_access']
        };

        return permissions[subscriptionTier] || permissions.free;
    }

    async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return { valid: false, error: 'Password must be at least 8 characters long' };
        }

        if (!hasUpperCase) {
            return { valid: false, error: 'Password must contain at least one uppercase letter' };
        }

        if (!hasLowerCase) {
            return { valid: false, error: 'Password must contain at least one lowercase letter' };
        }

        if (!hasNumbers) {
            return { valid: false, error: 'Password must contain at least one number' };
        }

        if (!hasSpecialChar) {
            return { valid: false, error: 'Password must contain at least one special character' };
        }

        return { valid: true };
    }

    async requirePermission(permission) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (!req.user.permissions.includes(permission)) {
                return res.status(403).json({ 
                    error: 'Insufficient permissions',
                    required: permission,
                    current: req.user.permissions
                });
            }

            next();
        };
    }

    async requireSubscriptionTier(minTier) {
        const tierLevels = {
            'free': 0,
            'basic': 1,
            'premium': 2,
            'enterprise': 3
        };

        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const userTierLevel = tierLevels[req.user.subscriptionTier] || 0;
            const requiredTierLevel = tierLevels[minTier] || 0;

            if (userTierLevel < requiredTierLevel) {
                return res.status(403).json({
                    error: 'Higher subscription tier required',
                    required: minTier,
                    current: req.user.subscriptionTier
                });
            }

            next();
        };
    }

    generateCSRFToken() {
        return this.securityManager.generateCSRFToken();
    }

    validateCSRFToken(token) {
        // In a real implementation, you'd validate against a stored token
        return typeof token === 'string' && token.length === 64;
    }

    async logAuthAttempt(email, success, ipAddress, userAgent, reason = null) {
        await this.auditLogger.logLoginAttempt(
            email, 
            success, 
            ipAddress, 
            userAgent, 
            reason
        );
    }
}

module.exports = new AuthMiddleware();
