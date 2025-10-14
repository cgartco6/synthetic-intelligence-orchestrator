const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const Binance = require('node-binance-api');

class PaymentDistributor {
    constructor() {
        this.initPayPal();
        this.initBinance();
        this.initFNB();
    }

    initPayPal() {
        this.paypalEnvironment = new paypal.core.SandboxEnvironment(
            process.env.PAYPAL_CLIENT_ID,
            process.env.PAYPAL_CLIENT_SECRET
        );
        this.paypalClient = new paypal.core.PayPalHttpClient(this.paypalEnvironment);
    }

    initBinance() {
        this.binance = new Binance().options({
            APIKEY: process.env.BINANCE_API_KEY,
            APISECRET: process.env.BINANCE_API_SECRET
        });
    }

    initFNB() {
        // FNB Bank API integration (South Africa)
        this.fnbBaseUrl = 'https://api.fnb.co.za';
        this.fnbHeaders = {
            'Authorization': `Bearer ${process.env.FNB_API_TOKEN}`,
            'Content-Type': 'application/json'
        };
    }

    async distributeRevenue(totalRevenue) {
        const ownerShare = totalRevenue * 0.60; // 60% to owner
        const platformShare = totalRevenue * 0.40; // 40% for platform costs

        const distribution = {
            paypal: ownerShare * 0.40, // 40% to PayPal
            fnb: ownerShare * 0.40,    // 40% to FNB
            binance: ownerShare * 0.20 // 20% to Binance
        };

        // Execute payouts
        const results = await Promise.allSettled([
            this.payoutToPayPal(distribution.paypal),
            this.payoutToFNB(distribution.fnb),
            this.payoutToBinance(distribution.binance)
        ]);

        return {
            totalRevenue,
            distribution,
            results: results.map((result, index) => ({
                method: ['paypal', 'fnb', 'binance'][index],
                success: result.status === 'fulfilled',
                data: result.status === 'fulfilled' ? result.value : result.reason
            }))
        };
    }

    async payoutToPayPal(amount) {
        const request = new paypal.payouts.PayoutsPostRequest();
        request.requestBody({
            sender_batch_header: {
                sender_batch_id: `Payouts_${Date.now()}`,
                email_subject: "You have a payout from AI Orchestrator"
            },
            items: [{
                recipient_type: "EMAIL",
                amount: {
                    value: amount.toFixed(2),
                    currency: "USD"
                },
                receiver: process.env.PAYPAL_RECEIVER_EMAIL,
                note: "Monthly revenue share from AI Orchestrator",
                sender_item_id: `item_${Date.now()}`
            }]
        });

        const response = await this.paypalClient.execute(request);
        return response.result;
    }

    async payoutToFNB(amount) {
        // FNB Bank transfer API (South Africa)
        const response = await axios.post(`${this.fnbBaseUrl}/api/transfers`, {
            from_account: process.env.FNB_BUSINESS_ACCOUNT,
            to_account: process.env.FNB_OWNER_ACCOUNT,
            amount: amount,
            currency: 'ZAR',
            reference: `AI Revenue Share ${new Date().toISOString().split('T')[0]}`
        }, { headers: this.fnbHeaders });

        return response.data;
    }

    async payoutToBinance(amount) {
        // Convert to USDT and transfer to Binance
        const transfer = await this.binance.futuresTransfer(
            'USDT',
            amount.toFixed(2),
            process.env.BINANCE_EMAIL
        );
        
        return transfer;
    }

    async processMonthlyPayout() {
        // Calculate monthly revenue
        const monthlyRevenue = await this.calculateMonthlyRevenue();
        
        if (monthlyRevenue > 0) {
            return await this.distributeRevenue(monthlyRevenue);
        }
        
        return { message: "No revenue to distribute this month" };
    }
}

module.exports = PaymentDistributor;
