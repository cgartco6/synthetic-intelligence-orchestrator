const express = require('express');
const router = express.Router();
const rateLimit = require('../middleware/rate-limiter');
const AuditLogger = require('../../security/audit-logger');
const MultiPayoutManager = require('../../payout/multi-payout');

const auditLogger = new AuditLogger();
const payoutManager = new MultiPayoutManager();

// Apply payment-specific rate limiting
router.use(rateLimit.paymentLimiter);

router.post('/create-intent', async (req, res) => {
    try {
        const { amount, currency = 'USD', paymentMethod } = req.body;
        const user = req.user;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        // In a real implementation, this would create a payment intent
        // with Stripe or other payment processor

        const paymentIntent = {
            id: `pi_${Date.now()}`,
            amount: amount,
            currency: currency.toLowerCase(),
            status: 'requires_payment_method',
            client_secret: `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        await auditLogger.logPaymentEvent(
            user.id,
            'INTENT_CREATED',
            amount,
            currency,
            'pending',
            {
                paymentMethod,
                ipAddress: req.ip
            }
        );

        res.json({
            success: true,
            paymentIntent: paymentIntent
        });

    } catch (error) {
        console.error('Create payment intent error:', error);
        
        await auditLogger.logPaymentEvent(
            req.user?.id,
            'INTENT_CREATED',
            req.body.amount,
            req.body.currency,
            'failed',
            {
                error: error.message,
                ipAddress: req.ip
            }
        );

        res.status(500).json({
            success: false,
            error: 'Failed to create payment intent'
        });
    }
});

router.post('/confirm', async (req, res) => {
    try {
        const { paymentIntentId, paymentMethod } = req.body;
        const user = req.user;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment intent ID is required' });
        }

        // In a real implementation, this would confirm the payment with the processor
        // For now, we'll simulate a successful payment

        const payment = {
            id: `pay_${Date.now()}`,
            intentId: paymentIntentId,
            amount: 100, // Example amount
            currency: 'usd',
            status: 'succeeded',
            paymentMethod: paymentMethod,
            createdAt: new Date().toISOString()
        };

        await auditLogger.logPaymentEvent(
            user.id,
            'PAYMENT_CONFIRMED',
            payment.amount,
            payment.currency,
            'completed',
            {
                paymentMethod,
                paymentId: payment.id,
                ipAddress: req.ip
            }
        );

        // Record payment in database
        await recordPayment({
            userId: user.id,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paymentMethod: paymentMethod
        });

        res.json({
            success: true,
            payment: payment
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        
        await auditLogger.logPaymentEvent(
            req.user.id,
            'PAYMENT_CONFIRMED',
            req.body.amount,
            req.body.currency,
            'failed',
            {
                error: error.message,
                ipAddress: req.ip
            }
        );

        res.status(500).json({
            success: false,
            error: 'Payment confirmation failed'
        });
    }
});

router.get('/methods', async (req, res) => {
    try {
        const user = req.user;
        const country = user.country || 'US';

        const availableMethods = await payoutManager.getPayoutMethods(country);

        res.json({
            success: true,
            paymentMethods: availableMethods,
            country: country
        });

    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment methods'
        });
    }
});

router.get('/history', async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10, offset = 0 } = req.query;

        const payments = await getPaymentHistory(user.id, parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            payments: payments,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: payments.length
            }
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment history'
        });
    }
});

router.post('/payout', async (req, res) => {
    try {
        const { amount, payoutMethod, currency = 'USD' } = req.body;
        const user = req.user;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }

        if (!payoutMethod) {
            return res.status(400).json({ error: 'Payout method is required' });
        }

        const payoutRequest = {
            userId: user.id,
            amount: amount,
            currency: currency,
            payoutMethod: payoutMethod,
            country: user.country,
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        };

        const result = await payoutManager.processPayout(payoutRequest);

        await auditLogger.logSecurityEvent({
            userId: user.id,
            action: 'PAYOUT_REQUEST',
            resource: 'PAYMENT',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: result.success ? 'SUCCESS' : 'FAILED',
            details: {
                amount: amount,
                currency: currency,
                payoutMethod: payoutMethod,
                payoutId: result.payoutId,
                netAmount: result.netAmount
            }
        });

        res.json(result);

    } catch (error) {
        console.error('Process payout error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'PAYOUT_REQUEST',
            resource: 'PAYMENT',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Payout processing failed'
        });
    }
});

router.get('/payout-history', async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10, offset = 0 } = req.query;

        const payouts = await payoutManager.getUserPayoutHistory(user.id, parseInt(limit));

        res.json({
            success: true,
            payouts: payouts,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: payouts.length
            }
        });

    } catch (error) {
        console.error('Get payout history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payout history'
        });
    }
});

router.get('/balance', async (req, res) => {
    try {
        const user = req.user;

        // Calculate user's available balance
        const balance = await calculateUserBalance(user.id);

        res.json({
            success: true,
            balance: balance
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get balance'
        });
    }
});

// Webhook handlers for payment providers
router.post('/webhook/stripe', async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const payload = req.body;

        // Verify webhook signature
        // const event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);

        // Handle different event types
        // switch (event.type) {
        //     case 'payment_intent.succeeded':
        //         await handleSuccessfulPayment(event.data.object);
        //         break;
        //     case 'payment_intent.payment_failed':
        //         await handleFailedPayment(event.data.object);
        //         break;
        //     case 'customer.subscription.updated':
        //         await handleSubscriptionUpdate(event.data.object);
        //         break;
        // }

        // For now, just acknowledge receipt
        res.json({ received: true });

    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({ error: 'Webhook error' });
    }
});

router.post('/webhook/payfast', async (req, res) => {
    try {
        const payload = req.body;

        // Verify PayFast signature
        // const isValid = payfast.verifySignature(payload);
        // if (!isValid) {
        //     return res.status(400).json({ error: 'Invalid signature' });
        // }

        // Handle PayFast ITN (Instant Transaction Notification)
        // await handlePayFastNotification(payload);

        res.json({ received: true });

    } catch (error) {
        console.error('PayFast webhook error:', error);
        res.status(400).json({ error: 'Webhook error' });
    }
});

// Helper functions
async function recordPayment(paymentData) {
    const db = require('../services/database/mysql-connector');
    
    try {
        await db.execute(
            `INSERT INTO payments 
             (user_id, payment_id, amount, currency, status, payment_method, payment_date) 
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
                paymentData.userId,
                paymentData.paymentId,
                paymentData.amount,
                paymentData.currency,
                paymentData.status,
                paymentData.paymentMethod
            ]
        );
    } catch (error) {
        console.error('Error recording payment:', error);
    }
}

async function getPaymentHistory(userId, limit, offset) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT * FROM payments 
             WHERE user_id = ? 
             ORDER BY payment_date DESC 
             LIMIT ? OFFSET ?`,
            [userId, limit, offset]
        );

        return rows;
    } catch (error) {
        console.error('Error getting payment history:', error);
        return [];
    }
}

async function calculateUserBalance(userId) {
    const db = require('../services/database/mysql-connector');
    
    try {
        const [rows] = await db.execute(
            `SELECT 
                COALESCE(SUM(amount), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as available_balance
             FROM payments 
             WHERE user_id = ?`,
            [userId]
        );

        return {
            totalEarnings: parseFloat(rows[0].total_earnings),
            availableBalance: parseFloat(rows[0].available_balance),
            currency: 'USD'
        };
    } catch (error) {
        console.error('Error calculating balance:', error);
        return { totalEarnings: 0, availableBalance: 0, currency: 'USD' };
    }
}

module.exports = router;
