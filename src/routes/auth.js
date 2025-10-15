const express = require('express');
const router = express.Router();
const rateLimit = require('../middleware/rate-limiter');
const authMiddleware = require('../middleware/auth');
const UserModel = require('../models/user');
const AuditLogger = require('../../security/audit-logger');

const userModel = new UserModel();
const auditLogger = new AuditLogger();

// Apply rate limiting to auth routes
router.use(rateLimit.authLimiter);

router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            country = 'US',
            timezone = 'UTC'
        } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Validate password strength
        const passwordValidation = authMiddleware.validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // Validate email format
        if (!this.isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Create user
        const user = await userModel.createUser({
            email,
            password,
            firstName,
            lastName,
            country,
            timezone
        });

        // Generate JWT token
        const token = await authMiddleware.generateToken(user);

        // Log registration
        await auditLogger.logSecurityEvent({
            userId: user.id,
            action: 'REGISTER',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS'
        });

        // Track user signup for growth analytics
        const GrowthTracker = require('../../marketing/analytics-tracker');
        const growthTracker = new GrowthTracker();
        await growthTracker.trackUserSignup(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                subscriptionTier: user.subscriptionTier
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Log failed registration
        await auditLogger.logSecurityEvent({
            userId: 'unknown',
            action: 'REGISTER',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Get user by email
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            await auditLogger.logLoginAttempt(
                email, false, req.ip, req.get('User-Agent'), 'User not found'
            );
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isPasswordValid = await authMiddleware.verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            await auditLogger.logLoginAttempt(
                email, false, req.ip, req.get('User-Agent'), 'Invalid password'
            );
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = await authMiddleware.generateToken(user);

        // Log successful login
        await auditLogger.logLoginAttempt(
            email, true, req.ip, req.get('User-Agent')
        );

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                subscriptionTier: user.subscriptionTier,
                country: user.country
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        
        await auditLogger.logLoginAttempt(
            req.body.email, false, req.ip, req.get('User-Agent'), error.message
        );

        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

router.post('/logout', authMiddleware.verifyToken, async (req, res) => {
    try {
        // In a real implementation, you might want to blacklist the token
        // For now, we'll just log the logout
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'LOGOUT',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

router.get('/profile', authMiddleware.verifyToken, async (req, res) => {
    try {
        const user = await userModel.getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove sensitive information
        const { password_hash, ...userProfile } = user;

        res.json({
            success: true,
            user: userProfile
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile'
        });
    }
});

router.put('/profile', authMiddleware.verifyToken, async (req, res) => {
    try {
        const { firstName, lastName, country, timezone } = req.body;

        const updateData = {};
        if (firstName) updateData.first_name = firstName;
        if (lastName) updateData.last_name = lastName;
        if (country) updateData.country = country;
        if (timezone) updateData.timezone = timezone;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const success = await userModel.updateUser(req.user.id, updateData);

        if (success) {
            await auditLogger.logSecurityEvent({
                userId: req.user.id,
                action: 'PROFILE_UPDATE',
                resource: 'AUTH',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS'
            });

            res.json({
                success: true,
                message: 'Profile updated successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to update profile'
            });
        }

    } catch (error) {
        console.error('Profile update error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'PROFILE_UPDATE',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Profile update failed'
        });
    }
});

router.post('/change-password', authMiddleware.verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                error: 'Current password and new password are required' 
            });
        }

        // Get user with password hash
        const user = await userModel.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await authMiddleware.verifyPassword(
            currentPassword, 
            user.password_hash
        );

        if (!isCurrentPasswordValid) {
            await auditLogger.logSecurityEvent({
                userId: req.user.id,
                action: 'PASSWORD_CHANGE',
                resource: 'AUTH',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'FAILED',
                details: { reason: 'Invalid current password' }
            });

            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Validate new password strength
        const passwordValidation = authMiddleware.validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // Hash new password
        const newPasswordHash = await authMiddleware.hashPassword(newPassword);

        // Update password
        const success = await userModel.updateUser(req.user.id, {
            password_hash: newPasswordHash
        });

        if (success) {
            await auditLogger.logSecurityEvent({
                userId: req.user.id,
                action: 'PASSWORD_CHANGE',
                resource: 'AUTH',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS'
            });

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Failed to change password'
            });
        }

    } catch (error) {
        console.error('Password change error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'PASSWORD_CHANGE',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Password change failed'
        });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            // Don't reveal whether email exists or not
            return res.json({
                success: true,
                message: 'If the email exists, a password reset link has been sent'
            });
        }

        // Generate reset token (in a real app, you'd send an email)
        const resetToken = authMiddleware.generateCSRFToken();
        
        // Store reset token with expiration (simplified)
        // In real implementation, store in database with expiration

        await auditLogger.logSecurityEvent({
            userId: user.id,
            action: 'PASSWORD_RESET_REQUEST',
            resource: 'AUTH',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS'
        });

        res.json({
            success: true,
            message: 'If the email exists, a password reset link has been sent'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Password reset request failed'
        });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ 
                error: 'Reset token and new password are required' 
            });
        }

        // Validate token and get user (simplified)
        // In real implementation, verify token from database

        // Validate new password strength
        const passwordValidation = authMiddleware.validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // For demo purposes, we'll assume token is valid
        // In real app, you'd look up the user associated with the token

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Password reset failed'
        });
    }
});

// Helper method to validate email format
isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

module.exports = router;
