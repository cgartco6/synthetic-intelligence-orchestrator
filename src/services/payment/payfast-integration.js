const crypto = require('crypto');
const axios = require('axios');

class PayFastIntegration {
    constructor() {
        this.merchantId = process.env.PAYFAST_MERCHANT_ID;
        this.merchantKey = process.env.PAYFAST_MERCHANT_KEY;
        this.passphrase = process.env.PAYFAST_PASSPHRASE;
        this.baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://www.payfast.co.za/eng/process'
            : 'https://sandbox.payfast.co.za/eng/process';
    }

    async createSubscription(params) {
        const { user, tier, amount, currency } = params;
        
        const subscriptionData = {
            merchant_id: this.merchantId,
            merchant_key: this.merchantKey,
            return_url: `${process.env.DOMAIN}/success`,
            cancel_url: `${process.env.DOMAIN}/pricing`,
            notify_url: `${process.env.DOMAIN}/api/webhooks/payfast`,
            name_first: user.firstName || '',
            name_last: user.lastName || '',
            email_address: user.email,
            m_payment_id: `sub_${user.id}_${Date.now()}`,
            amount: amount.toFixed(2),
            item_name: `${tier} Subscription - AI Orchestrator`,
            item_description: `Monthly ${tier} subscription for AI content generation services`,
            subscription_type: 1, // 1 for subscription
            recurring_amount: amount.toFixed(2),
            frequency: 3, // 3 for monthly
            cycles: 0, // 0 for indefinite
            custom_str1: user.id,
            custom_str2: tier,
            custom_str3: currency
        };

        // Remove empty values
        Object.keys(subscriptionData).forEach(key => {
            if (subscriptionData[key] === '' || subscriptionData[key] === null) {
                delete subscriptionData[key];
            }
        });

        // Generate signature
        subscriptionData.signature = this.generateSignature(subscriptionData);

        return {
            gateway: 'payfast',
            url: this.baseUrl,
            method: 'POST',
            data: subscriptionData
        };
    }

    generateSignature(data) {
        // Sort data alphabetically
        const sortedKeys = Object.keys(data).sort();
        let signatureString = '';
        
        sortedKeys.forEach(key => {
            if (data[key] !== '' && key !== 'signature') {
                signatureString += `${key}=${encodeURIComponent(data[key].toString().trim()).replace(/%20/g, '+')}&`;
            }
        });
        
        // Remove last ampersand
        signatureString = signatureString.slice(0, -1);
        
        if (this.passphrase) {
            signatureString += `&passphrase=${encodeURIComponent(this.passphrase.trim()).replace(/%20/g, '+')}`;
        }
        
        return crypto.createHash('md5').update(signatureString).digest('hex');
    }

    verifySignature(data) {
        try {
            const receivedSignature = data.signature;
            // Create a copy of data and remove the signature for verification
            const verificationData = { ...data };
            delete verificationData.signature;
            
            const calculatedSignature = this.generateSignature(verificationData);
            return receivedSignature === calculatedSignature;
        } catch (error) {
            console.error('PayFast signature verification error:', error);
            return false;
        }
    }

    async handleInstantTransactionNotification(itnData) {
        try {
            // Verify the ITN signature
            if (!this.verifySignature(itnData)) {
                throw new Error('Invalid PayFast ITN signature');
            }

            const paymentStatus = itnData.payment_status;
            const merchantPaymentId = itnData.m_payment_id;
            const amount = parseFloat(itnData.amount_gross);

            // Extract user ID and tier from custom fields
            const userId = itnData.custom_str1;
            const tier = itnData.custom_str2;
            const currency = itnData.custom_str3;

            console.log(`PayFast ITN received: ${paymentStatus} for user ${userId}, amount ${amount} ${currency}`);

            // Handle different payment statuses
            switch (paymentStatus) {
                case 'COMPLETE':
                    await this.handleSuccessfulPayment(userId, tier, amount, currency, itnData);
                    break;
                    
                case 'FAILED':
                    await this.handleFailedPayment(userId, tier, amount, currency, itnData);
                    break;
                    
                case 'PENDING':
                    await this.handlePendingPayment(userId, tier, amount, currency, itnData);
                    break;
                    
                case 'CANCELLED':
                    await this.handleCancelledPayment(userId, tier, amount, currency, itnData);
                    break;
                    
                default:
                    console.log(`Unhandled PayFast status: ${paymentStatus}`);
            }

            return { success: true, processed: true };

        } catch (error) {
            console.error('PayFast ITN processing error:', error);
            return { success: false, error: error.message };
        }
    }

    async handleSuccessfulPayment(userId, tier, amount, currency, itnData) {
        const SubscriptionModel = require('../../models/subscription');
        const subscriptionModel = new SubscriptionModel();
        
        const AuditLogger = require('../../../security/audit-logger');
        const auditLogger = new AuditLogger();

        try {
            // Update or create subscription
            await subscriptionModel.upgradeUserTier(userId, tier);

            // Record payment
            const db = require('../database/mysql-connector');
            await db.execute(
                `INSERT INTO payments 
                 (user_id, payment_id, amount, currency, status, payment_method, payment_date) 
                 VALUES (?, ?, ?, ?, 'completed', 'payfast', NOW())`,
                [userId, itnData.pf_payment_id, amount, currency]
            );

            // Log the successful payment
            await auditLogger.logPaymentEvent(
                userId,
                'SUBSCRIPTION_PAYMENT',
                amount,
                currency,
                'completed',
                {
                    gateway: 'payfast',
                    paymentId: itnData.pf_payment_id,
                    tier: tier
                }
            );

            console.log(`Successfully processed PayFast payment for user ${userId}, tier ${tier}`);

        } catch (error) {
            console.error('Error handling successful PayFast payment:', error);
            throw error;
        }
    }

    async handleFailedPayment(userId, tier, amount, currency, itnData) {
        const AuditLogger = require('../../../security/audit-logger');
        const auditLogger = new AuditLogger();

        await auditLogger.logPaymentEvent(
            userId,
            'SUBSCRIPTION_PAYMENT',
            amount,
            currency,
            'failed',
            {
                gateway: 'payfast',
                paymentId: itnData.pf_payment_id,
                tier: tier,
                reason: itnData.payment_status_reason
            }
        );

        console.log(`PayFast payment failed for user ${userId}: ${itnData.payment_status_reason}`);
    }

    async handlePendingPayment(userId, tier, amount, currency, itnData) {
        const AuditLogger = require('../../../security/audit-logger');
        const auditLogger = new AuditLogger();

        await auditLogger.logPaymentEvent(
            userId,
            'SUBSCRIPTION_PAYMENT',
            amount,
            currency,
            'pending',
            {
                gateway: 'payfast',
                paymentId: itnData.pf_payment_id,
                tier: tier
            }
        );

        console.log(`PayFast payment pending for user ${userId}`);
    }

    async handleCancelledPayment(userId, tier, amount, currency, itnData) {
        const AuditLogger = require('../../../security/audit-logger');
        const auditLogger = new AuditLogger();

        await auditLogger.logPaymentEvent(
            userId,
            'SUBSCRIPTION_PAYMENT',
            amount,
            currency,
            'cancelled',
            {
                gateway: 'payfast',
                paymentId: itnData.pf_payment_id,
                tier: tier
            }
        );

        console.log(`PayFast payment cancelled for user ${userId}`);
    }

    async queryPaymentStatus(paymentId) {
        try {
            const params = {
                merchant_id: this.merchantId,
                merchant_key: this.merchantKey,
                pf_payment_id: paymentId
            };

            params.signature = this.generateSignature(params);

            const response = await axios.get('https://api.payfast.co.za/query/validate', {
                params: params
            });

            return response.data;

        } catch (error) {
            console.error('PayFast query error:', error);
            throw error;
        }
    }

    getSupportedCurrencies() {
        return ['ZAR']; // PayFast primarily supports South African Rand
    }

    isCurrencySupported(currency) {
        return this.getSupportedCurrencies().includes(currency);
    }
}

module.exports = PayFastIntegration;
