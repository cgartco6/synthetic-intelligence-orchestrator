const paypal = require('@paypal/checkout-server-sdk');
const axios = require('axios');

class PaymentDistributor {
    constructor() {
        this.initPayPal();
        this.initFNB();
        this.initBinance();
        this.taxRates = this.loadTaxRates();
    }

    initPayPal() {
        const environment = process.env.NODE_ENV === 'production' 
            ? new paypal.core.LiveEnvironment(
                process.env.PAYPAL_CLIENT_ID,
                process.env.PAYPAL_CLIENT_SECRET
              )
            : new paypal.core.SandboxEnvironment(
                process.env.PAYPAL_CLIENT_ID,
                process.env.PAYPAL_CLIENT_SECRET
              );

        this.paypalClient = new paypal.core.PayPalHttpClient(environment);
    }

    initFNB() {
        this.fnbConfig = {
            baseUrl: 'https://api.fnb.co.za',
            headers: {
                'Authorization': `Bearer ${process.env.FNB_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Client-ID': process.env.FNB_CLIENT_ID
            }
        };
    }

    initBinance() {
        this.binanceConfig = {
            apiKey: process.env.BINANCE_API_KEY,
            secretKey: process.env.BINANCE_API_SECRET,
            baseUrl: 'https://api.binance.com'
        };
    }

    loadTaxRates() {
        return {
            'ZA': 0.15, // South Africa VAT
            'EU': 0.21, // European VAT average
            'US': 0.00, // US sales tax handled differently
            'default': 0.00
        };
    }

    async distributeRevenue(totalRevenue, country = 'US') {
        try {
            // Calculate tax obligations
            const taxAmount = this.calculateTax(totalRevenue, country);
            const netRevenue = totalRevenue - taxAmount;
            
            // Owner gets 60% of net revenue
            const ownerShare = netRevenue * 0.60;
            const platformShare = netRevenue * 0.40;

            const distribution = {
                paypal: ownerShare * 0.40, // 40% to PayPal
                fnb: ownerShare * 0.40,    // 40% to FNB
                binance: ownerShare * 0.20 // 20% to Binance
            };

            console.log(`Revenue Distribution: Total: $${totalRevenue}, Tax: $${taxAmount}, Net: $${netRevenue}, Owner: $${ownerShare}`);

            // Execute payouts
            const results = await Promise.allSettled([
                this.payoutToPayPal(distribution.paypal),
                this.payoutToFNB(distribution.fnb),
                this.payoutToBinance(distribution.binance)
            ]);

            // Record the distribution
            await this.recordRevenueDistribution({
                totalRevenue,
                taxAmount,
                netRevenue,
                ownerShare,
                platformShare,
                distribution,
                country
            });

            return {
                success: true,
                totalRevenue,
                taxAmount,
                netRevenue,
                distribution,
                results: results.map((result, index) => ({
                    method: ['paypal', 'fnb', 'binance'][index],
                    success: result.status === 'fulfilled',
                    data: result.status === 'fulfilled' ? result.value : result.reason
                }))
            };

        } catch (error) {
            console.error('Revenue distribution failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    calculateTax(amount, country) {
        const taxRate = this.taxRates[country] || this.taxRates.default;
        return amount * taxRate;
    }

    async payoutToPayPal(amount) {
        try {
            const request = new paypal.payouts.PayoutsPostRequest();
            request.requestBody({
                sender_batch_header: {
                    sender_batch_id: `payout_${Date.now()}`,
                    email_subject: "AI Orchestrator Revenue Share",
                    email_message: "Thank you for your work! Here is your revenue share from AI Orchestrator."
                },
                items: [{
                    recipient_type: "EMAIL",
                    amount: {
                        value: amount.toFixed(2),
                        currency: "USD"
                    },
                    receiver: process.env.PAYPAL_RECEIVER_EMAIL,
                    note: "Monthly revenue share payment",
                    sender_item_id: `item_${Date.now()}`
                }]
            });

            const response = await this.paypalClient.execute(request);
            
            console.log('PayPal payout successful:', response.result.batch_header.payout_batch_id);
            return {
                batch_id: response.result.batch_header.payout_batch_id,
                amount: amount,
                status: 'SUCCESS'
            };
        } catch (error) {
            console.error('PayPal payout failed:', error);
            throw new Error(`PayPal payout failed: ${error.message}`);
        }
    }

    async payoutToFNB(amount) {
        try {
            // Convert to ZAR if needed
            const zarAmount = await this.convertToZAR(amount);
            
            const response = await axios.post(
                `${this.fnbConfig.baseUrl}/api/v1/transfers`,
                {
                    from_account: process.env.FNB_BUSINESS_ACCOUNT,
                    to_account: process.env.FNB_OWNER_ACCOUNT,
                    amount: zarAmount,
                    currency: 'ZAR',
                    reference: `AI Revenue ${new Date().toISOString().split('T')[0]}`,
                    description: 'Monthly revenue distribution'
                },
                { headers: this.fnbConfig.headers }
            );

            console.log('FNB payout successful:', response.data.transfer_id);
            return {
                transfer_id: response.data.transfer_id,
                amount: zarAmount,
                currency: 'ZAR',
                status: 'SUCCESS'
            };
        } catch (error) {
            console.error('FNB payout failed:', error);
            throw new Error(`FNB payout failed: ${error.message}`);
        }
    }

    async payoutToBinance(amount) {
        try {
            // For Binance, we typically transfer crypto
            const usdtAmount = amount; // Assuming USD amount for USDT
            
            // This would require Binance's transfer API
            // For now, we'll simulate the response
            console.log(`Simulating Binance transfer of $${amount} USDT`);
            
            return {
                success: true,
                amount: usdtAmount,
                currency: 'USDT',
                status: 'SIMULATED_SUCCESS',
                note: 'Real Binance integration requires additional setup'
            };
        } catch (error) {
            console.error('Binance payout failed:', error);
            throw new Error(`Binance payout failed: ${error.message}`);
        }
    }

    async convertToZAR(usdAmount) {
        try {
            const response = await axios.get(
                `https://api.exchangerate-api.com/v4/latest/USD`
            );
            const rate = response.data.rates.ZAR;
            return usdAmount * rate;
        } catch (error) {
            // Fallback rate if API fails
            console.error('Currency conversion failed, using fallback rate');
            return usdAmount * 18.5; // Fallback ZAR rate
        }
    }

    async recordRevenueDistribution(distribution) {
        // Record in database for accounting and auditing
        const db = require('../src/services/database/mysql-connector');
        
        try {
            await db.execute(
                `INSERT INTO revenue_distributions 
                 (total_revenue, tax_amount, net_revenue, owner_share, platform_share, 
                  paypal_amount, fnb_amount, binance_amount, country, distribution_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    distribution.totalRevenue,
                    distribution.taxAmount,
                    distribution.netRevenue,
                    distribution.ownerShare,
                    distribution.platformShare,
                    distribution.distribution.paypal,
                    distribution.distribution.fnb,
                    distribution.distribution.binance,
                    distribution.country
                ]
            );
        } catch (error) {
            console.error('Failed to record revenue distribution:', error);
        }
    }

    async processMonthlyPayout() {
        try {
            // Calculate monthly revenue from database
            const monthlyRevenue = await this.calculateMonthlyRevenue();
            
            if (monthlyRevenue > 0) {
                const result = await this.distributeRevenue(monthlyRevenue);
                
                // Send notification
                await this.sendPayoutNotification(result);
                
                return result;
            }
            
            return { 
                success: true, 
                message: "No revenue to distribute this month",
                revenue: 0 
            };
            
        } catch (error) {
            console.error('Monthly payout processing failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async calculateMonthlyRevenue() {
        const db = require('../src/services/database/mysql-connector');
        
        try {
            const [rows] = await db.execute(
                `SELECT SUM(amount) as total_revenue 
                 FROM payments 
                 WHERE status = 'completed' 
                 AND payment_date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`
            );
            
            return rows[0].total_revenue || 0;
        } catch (error) {
            console.error('Failed to calculate monthly revenue:', error);
            return 0;
        }
    }

    async sendPayoutNotification(result) {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;
        
        if (webhookUrl) {
            try {
                await axios.post(webhookUrl, {
                    text: `💰 Monthly Payout Processed`,
                    attachments: [
                        {
                            color: result.success ? 'good' : 'danger',
                            fields: [
                                {
                                    title: 'Total Revenue',
                                    value: `$${result.totalRevenue}`,
                                    short: true
                                },
                                {
                                    title: 'Net Revenue',
                                    value: `$${result.netRevenue}`,
                                    short: true
                                },
                                {
                                    title: 'Owner Share',
                                    value: `$${result.ownerShare}`,
                                    short: true
                                },
                                {
                                    title: 'Status',
                                    value: result.success ? 'Success' : 'Failed',
                                    short: true
                                }
                            ]
                        }
                    ]
                });
            } catch (error) {
                console.error('Failed to send payout notification:', error);
            }
        }
    }
}

module.exports = PaymentDistributor;
