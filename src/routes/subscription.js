const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PayFast = require('../services/payment/payfast-integration');

const subscriptionTiers = {
    'free': {
        price: 0,
        limits: {
            text: 5,      // 5 text tasks per day
            image: 1,     // 1 image task per day
            code: 1,      // 1 code task per day
            research: 1,  // 1 research task per day
            analysis: 1,  // 1 analysis task per day
            voice: 0      // No voice tasks
        },
        adFrequency: 'high', // Ad every task
        features: [
            '5 text tasks daily',
            '1 image task daily',
            '1 code task daily',
            '1 research task daily',
            'Ad-supported (high-paying 30s ads)'
        ]
    },
    'basic': {
        price: 19,
        limits: {
            text: 50,     // 50 text tasks per day
            image: 10,    // 10 image tasks per day
            code: 10,     // 10 code tasks per day
            research: 10, // 10 research tasks per day
            analysis: 10, // 10 analysis tasks per day
            voice: 5      // 5 voice tasks per day
        },
        adFrequency: 'medium', // Ad every 3 tasks
        features: [
            '50 text tasks daily',
            '10 image tasks daily',
            '10 code tasks daily',
            '10 research tasks daily',
            '5 voice tasks daily',
            'Reduced ads'
        ]
    },
    'premium': {
        price: 39,
        limits: {
            text: 200,    // 200 text tasks per day
            image: 50,    // 50 image tasks per day
            code: 50,     // 50 code tasks per day
            research: 50, // 50 research tasks per day
            analysis: 50, // 50 analysis tasks per day
            voice: 20     // 20 voice tasks per day
        },
        adFrequency: 'low', // 1 high-paying ad per day
        features: [
            '200 text tasks daily',
            '50 image tasks daily',
            '50 code tasks daily',
            '50 research tasks daily',
            '20 voice tasks daily',
            'Only 1 high-paying ad daily'
        ]
    },
    'enterprise': {
        price: 59,
        limits: {
            text: -1,     // Unlimited
            image: -1,    // Unlimited
            code: -1,     // Unlimited
            research: -1, // Unlimited
            analysis: -1, // Unlimited
            voice: -1     // Unlimited
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

// Currency conversion rates (example - use real API)
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

router.post('/create-checkout-session', async (req, res) => {
    const { tier, country = 'US' } = req.body;
    const user = req.user;
    
    const currency = getCurrencyForCountry(country);
    const localizedPrice = convertPrice(subscriptionTiers[tier].price, currency);
    
    if (tier === 'free') {
        await UserService.upgradeToFree(user.id);
        return res.json({ 
            success: true, 
            tier: 'free',
            message: 'Free account activated successfully!'
        });
    }

    // Determine payment gateway based on country
    const paymentGateway = shouldUsePayFast(country) ? 'payfast' : 'stripe';
    
    if (paymentGateway === 'payfast') {
        const payfastSession = await PayFast.createSubscription({
            user: user,
            tier: tier,
            amount: localizedPrice.amount,
            currency: currency
        });
        return res.json(payfastSession);
    } else {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: currency.toLowerCase(),
                    product_data: {
                        name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
                        description: subscriptionTiers[tier].features.join(', ')
                    },
                    unit_amount: localizedPrice.amount * 100, // in cents
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

        res.json({ 
            id: session.id, 
            gateway: 'stripe',
            currency: currency,
            amount: localizedPrice.amount,
            symbol: localizedPrice.symbol
        });
    }
});

function getCurrencyForCountry(country) {
    const countryCurrencyMap = {
        'ZA': 'ZAR', 'NA': 'ZAR', 'BW': 'ZAR', // South Africa, Namibia, Botswana
        'US': 'USD', 'CA': 'CAD', 'MX': 'MXN', // North America
        'GB': 'GBP', 'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', // Europe
        'JP': 'JPY', 'CN': 'CNY', 'IN': 'INR', 'AU': 'AUD', // Asia Pacific
        // Add more countries as needed
    };
    return countryCurrencyMap[country] || 'USD';
}

function convertPrice(usdPrice, targetCurrency) {
    const rate = currencyRates[targetCurrency] || 1;
    const symbols = {
        'USD': '$', 'ZAR': 'R', 'EUR': '€', 'GBP': '£', 
        'JPY': '¥', 'AUD': 'A$', 'CAD': 'C$', 'INR': '₹'
    };
    
    return {
        amount: Math.round(usdPrice * rate * 100) / 100,
        symbol: symbols[targetCurrency] || '$',
        currency: targetCurrency
    };
}

function shouldUsePayFast(country) {
    return ['ZA', 'NA', 'BW'].includes(country);
}
