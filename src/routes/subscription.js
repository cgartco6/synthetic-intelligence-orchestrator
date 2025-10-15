const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PayFastIntegration = require('../services/payment/payfast-integration');
const SubscriptionModel = require('../models/subscription');
const AuditLogger = require('../../security/audit-logger');

const subscriptionModel = new SubscriptionModel();
const auditLogger = new AuditLogger();
const payfast = new PayFastIntegration();

const subscriptionTiers = {
    'free': {
        price: 0,
        limits: {
            text: 5, image: 1, code: 1, research: 1, analysis: 1, voice: 0
        },
        adFrequency: 'high',
        features: [
            '5 text tasks daily',
            '1 image task daily',
            '1 code task daily',
            '1 research task daily',
            '1 analysis task daily',
            'Ad-supported (high-paying 30s ads)'
        ]
    },
    'basic': {
        price: 19,
        limits: {
            text: 50, image: 10, code: 10, research: 10, analysis: 10, voice: 5
        },
        adFrequency: 'medium',
        features: [
            '50 text tasks daily',
            '10 image tasks daily',
            '10 code tasks daily',
            '10 research tasks daily',
            '10 analysis tasks daily',
            '5 voice tasks daily',
            'Reduced ads'
        ]
    },
    'premium': {
        price: 39,
        limits: {
            text: 200, image: 50, code: 50, research: 50, analysis: 50, voice: 20
        },
        adFrequency: 'low',
        features: [
            '200 text tasks daily',
            '50 image tasks daily',
            '50 code tasks daily',
            '50 research tasks daily',
            '50 analysis tasks daily',
            '20 voice tasks daily',
            'Only 1 high-paying ad daily'
        ]
    },
    'enterprise': {
        price: 59,
        limits: {
            text: -1, image: -1, code: -1, research: -1, analysis: -1, voice: -1
        },
        adFrequency: 'none',
        features: [
            'Unlimited all tasks',
            'No ads',
            'Premium priority support',
            'Custom AI models',
            'API access',
            'Dedicated account manager'
        ]
    }
};

// Currency conversion rates (example - in production, use real API)
const currencyRates = {
    'USD': 1,
    'ZAR': 18.5,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 150,
    'AUD': 1.52,
    'CAD': 1.35,
    'INR': 83
};

// Currency symbols
const currencySymbols = {
    'USD': '$', 'ZAR': 'R', 'EUR': '€', 'GBP': '£', 
    'JPY': '¥', 'AUD': 'A$', 'CAD': 'C$', 'INR': '₹'
};

router.get('/pricing', (req, res) => {
    const country = req.query.country || 'US';
    const currency = getCurrencyForCountry(country);
    
    const pricingWithLocalCurrency = {};
    
    Object.keys(subscriptionTiers).forEach(tier => {
        const tierInfo = subscriptionTiers[tier];
        const localizedPrice = convertPrice(tierInfo.price, currency);
        
        pricingWithLocalCurrency[tier] = {
            ...tierInfo,
            localPrice: localizedPrice
        };
    });

    res.json({
        success: true,
        tiers: pricingWithLocalCurrency,
        currency: currency,
        country: country
    });
});

router.post('/create-checkout-session', async (req, res) => {
    try {
        const { tier, country = 'US' } = req.body;
        const user = req.user;

        if (!tier) {
            return res.status(400).json({ error: 'Subscription tier is required' });
        }

        if (tier === 'free') {
            await subscriptionModel.upgradeUserTier(user.id, 'free');
            
            await auditLogger.logSecurityEvent({
                userId: user.id,
                action: 'SUBSCRIPTION_UPGRADE',
                resource: 'SUBSCRIPTION',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS',
                details: { tier: 'free' }
            });

            return res.json({ 
                success: true, 
                tier: 'free',
                message: 'Free account activated successfully!'
            });
        }

        const currency = getCurrencyForCountry(country);
        const localizedPrice = convertPrice(subscriptionTiers[tier].price, currency);

        // Determine payment gateway based on country
        const paymentGateway = shouldUsePayFast(country) ? 'payfast' : 'stripe';
        
        if (paymentGateway === 'payfast') {
            const payfastSession = await payfast.createSubscription({
                user: user,
                tier: tier,
                amount: localizedPrice.amount,
                currency: currency
            });

            await auditLogger.logSecurityEvent({
                userId: user.id,
                action: 'SUBSCRIPTION_CHECKOUT',
                resource: 'SUBSCRIPTION',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'INITIATED',
                details: { 
                    tier: tier,
                    gateway: 'payfast',
                    amount: localizedPrice.amount,
                    currency: currency
                }
            });

            return res.json({
                success: true,
                gateway: 'payfast',
                ...payfastSession
            });
        } else {
            // Create Stripe Checkout Session
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
                            description: subscriptionTiers[tier].features.join(', ')
                        },
                        unit_amount: Math.round(localizedPrice.amount * 100), // in cents
                        recurring: {
                            interval: 'month'
                        }
                    },
                    quantity: 1,
                }],
                mode: 'subscription',
                success_url: `${process.env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.DOMAIN}/pricing`,
                customer_email: user.email,
                metadata: {
                    userId: user.id,
                    tier: tier,
                    country: country
                }
            });

            await auditLogger.logSecurityEvent({
                userId: user.id,
                action: 'SUBSCRIPTION_CHECKOUT',
                resource: 'SUBSCRIPTION',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'INITIATED',
                details: { 
                    tier: tier,
                    gateway: 'stripe',
                    amount: localizedPrice.amount,
                    currency: currency
                }
            });

            res.json({ 
                success: true,
                id: session.id, 
                gateway: 'stripe',
                currency: currency,
                amount: localizedPrice.amount,
                symbol: localizedPrice.symbol
            });
        }

    } catch (error) {
        console.error('Checkout session creation error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user?.id,
            action: 'SUBSCRIPTION_CHECKOUT',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to create checkout session'
        });
    }
});

router.get('/current', async (req, res) => {
    try {
        const user = req.user;
        const subscription = await subscriptionModel.getSubscriptionByUserId(user.id);

        if (!subscription) {
            return res.json({
                success: true,
                subscription: {
                    tier: 'free',
                    status: 'active',
                    isTrial: false,
                    features: subscriptionTiers.free.features,
                    limits: subscriptionTiers.free.limits
                }
            });
        }

        res.json({
            success: true,
            subscription: {
                ...subscription,
                features: subscriptionTiers[subscription.tier].features,
                limits: subscriptionTiers[subscription.tier].limits
            }
        });

    } catch (error) {
        console.error('Get current subscription error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get subscription'
        });
    }
});

router.post('/upgrade', async (req, res) => {
    try {
        const { tier } = req.body;
        const user = req.user;

        if (!tier) {
            return res.status(400).json({ error: 'Subscription tier is required' });
        }

        if (!subscriptionTiers[tier]) {
            return res.status(400).json({ error: 'Invalid subscription tier' });
        }

        // For free tier, upgrade immediately
        if (tier === 'free') {
            await subscriptionModel.upgradeUserTier(user.id, 'free');
            
            await auditLogger.logSecurityEvent({
                userId: user.id,
                action: 'SUBSCRIPTION_UPGRADE',
                resource: 'SUBSCRIPTION',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'SUCCESS',
                details: { tier: 'free' }
            });

            return res.json({
                success: true,
                message: 'Successfully upgraded to free tier',
                tier: 'free'
            });
        }

        // For paid tiers, redirect to checkout
        const country = user.country || 'US';
        const currency = getCurrencyForCountry(country);
        const localizedPrice = convertPrice(subscriptionTiers[tier].price, currency);

        res.json({
            success: true,
            action: 'checkout_required',
            tier: tier,
            price: localizedPrice.amount,
            currency: currency,
            symbol: localizedPrice.symbol
        });

    } catch (error) {
        console.error('Upgrade subscription error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'SUBSCRIPTION_UPGRADE',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to process upgrade'
        });
    }
});

router.post('/cancel', async (req, res) => {
    try {
        const { cancelAtPeriodEnd = true } = req.body;
        const user = req.user;

        const subscription = await subscriptionModel.getSubscriptionByUserId(user.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'No active subscription found' });
        }

        if (subscription.tier === 'free') {
            return res.status(400).json({ error: 'Cannot cancel free subscription' });
        }

        // Cancel the subscription
        await subscriptionModel.cancelSubscription(subscription.id, cancelAtPeriodEnd);

        // Downgrade to free tier if immediate cancellation
        if (!cancelAtPeriodEnd) {
            await subscriptionModel.upgradeUserTier(user.id, 'free');
        }

        await auditLogger.logSecurityEvent({
            userId: user.id,
            action: 'SUBSCRIPTION_CANCEL',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: { 
                tier: subscription.tier,
                cancelAtPeriodEnd: cancelAtPeriodEnd
            }
        });

        res.json({
            success: true,
            message: cancelAtPeriodEnd ? 
                'Subscription will cancel at the end of the billing period' :
                'Subscription canceled immediately',
            newTier: !cancelAtPeriodEnd ? 'free' : subscription.tier
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'SUBSCRIPTION_CANCEL',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to cancel subscription'
        });
    }
});

router.post('/reactivate', async (req, res) => {
    try {
        const user = req.user;

        const subscription = await subscriptionModel.getSubscriptionByUserId(user.id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'No subscription found' });
        }

        if (subscription.status === 'active') {
            return res.status(400).json({ error: 'Subscription is already active' });
        }

        // Reactivate the subscription
        await subscriptionModel.reactivateSubscription(subscription.id);

        await auditLogger.logSecurityEvent({
            userId: user.id,
            action: 'SUBSCRIPTION_REACTIVATE',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'SUCCESS',
            details: { tier: subscription.tier }
        });

        res.json({
            success: true,
            message: 'Subscription reactivated successfully',
            tier: subscription.tier
        });

    } catch (error) {
        console.error('Reactivate subscription error:', error);
        
        await auditLogger.logSecurityEvent({
            userId: req.user.id,
            action: 'SUBSCRIPTION_REACTIVATE',
            resource: 'SUBSCRIPTION',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'FAILED',
            details: { error: error.message }
        });

        res.status(500).json({
            success: false,
            error: 'Failed to reactivate subscription'
        });
    }
});

router.get('/invoices', async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10, offset = 0 } = req.query;

        // This would typically fetch from Stripe or PayFast
        // For now, return mock data
        const invoices = await getMockInvoices(user.id, parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            invoices: invoices,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: invoices.length
            }
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invoices'
        });
    }
});

// Helper functions
function getCurrencyForCountry(country) {
    const countryCurrencyMap = {
        'ZA': 'ZAR', 'NA': 'ZAR', 'BW': 'ZAR', // South Africa, Namibia, Botswana
        'US': 'USD', 'CA': 'CAD', 'MX': 'MXN', // North America
        'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', // Europe
        'JP': 'JPY', 'CN': 'CNY', 'IN': 'INR', 'AU': 'AUD', // Asia Pacific
        'BR': 'BRL', 'AR': 'ARS' // South America
    };
    return countryCurrencyMap[country] || 'USD';
}

function convertPrice(usdPrice, targetCurrency) {
    const rate = currencyRates[targetCurrency] || 1;
    
    return {
        amount: Math.round(usdPrice * rate * 100) / 100,
        symbol: currencySymbols[targetCurrency] || '$',
        currency: targetCurrency
    };
}

function shouldUsePayFast(country) {
    return ['ZA', 'NA', 'BW'].includes(country);
}

async function getMockInvoices(userId, limit, offset) {
    // In production, this would fetch real invoices from payment providers
    return [
        {
            id: 'inv_1',
            amount: 19,
            currency: 'USD',
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'paid',
            tier: 'basic'
        },
        {
            id: 'inv_2',
            amount: 19,
            currency: 'USD',
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'paid',
            tier: 'basic'
        }
    ].slice(offset, offset + limit);
}

module.exports = router;
