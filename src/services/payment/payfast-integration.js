const crypto = require('crypto');
const axios = require('axios');

class PayFastIntegration {
    constructor() {
        this.merchantId = process.env.PAYFAST_MERCHANT_ID;
        this.merchantKey = process.env.PAYFAST_MERCHANT_KEY;
        this.passphrase = process.env.PAYFAST_PASSPHRASE;
        this.baseUrl = process.env.PAYFAST_BASE_URL || 'https://www.payfast.co.za/eng/process';
    }

    async createSubscription(params) {
        const { user, tier, amount, currency } = params;
        
        const subscriptionData = {
            merchant_id: this.merchantId,
            merchant_key: this.merchantKey,
            return_url: `${process.env.DOMAIN}/success`,
            cancel_url: `${process.env.DOMAIN}/pricing`,
            notify_url: `${process.env.DOMAIN}/api/payment/payfast-webhook`,
            name_first: user.firstName,
            name_last: user.lastName,
            email_address: user.email,
            m_payment_id: `sub_${user.id}_${Date.now()}`,
            amount: amount.toFixed(2),
            item_name: `${tier} Subscription`,
            item_description: `Monthly subscription for ${tier} tier`,
            subscription_type: 1, // 1 for subscription
            recurring_amount: amount.toFixed(2),
            frequency: 3, // 3 for monthly
            cycles: 0, // 0 for indefinite
            custom_str1: user.id,
            custom_str2: tier
        };

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
        const receivedSignature = data.signature;
        const calculatedSignature = this.generateSignature(data);
        return receivedSignature === calculatedSignature;
    }
}

module.exports = PayFastIntegration;
