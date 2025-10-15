const PaymentDistributor = require('./payment-distributor');
const TaxCalculator = require('./tax-calculator');

class MultiPayoutManager {
    constructor() {
        this.paymentDistributor = new PaymentDistributor();
        this.taxCalculator = new TaxCalculator();
        this.supportedMethods = ['paypal', 'fnb', 'binance', 'wire_transfer'];
    }

    async processPayout(payoutRequest) {
        const {
            userId,
            amount,
            currency,
            payoutMethod,
            country,
            metadata = {}
        } = payoutRequest;

        // Validate payout request
        const validation = await this.validatePayoutRequest(payoutRequest);
        if (!validation.valid) {
            throw new Error(`Payout validation failed: ${validation.errors.join(', ')}`);
        }

        // Convert currency if needed
        const payoutAmount = await this.convertCurrency(amount, currency, payoutMethod);

        // Calculate fees
        const fees = this.calculatePayoutFees(payoutAmount, payoutMethod, country);
        const netAmount = payoutAmount - fees.total;

        // Process the payout
        const payoutResult = await this.executePayout({
            userId,
            amount: netAmount,
            payoutMethod,
            country,
            fees,
            metadata
        });

        // Record the transaction
        await this.recordPayoutTransaction({
            userId,
            grossAmount: payoutAmount,
            netAmount,
            fees,
            payoutMethod,
            country,
            payoutReference: payoutResult.reference,
            status: payoutResult.status
        });

        return {
            success: true,
            payoutId: payoutResult.reference,
            grossAmount: payoutAmount,
            netAmount: netAmount,
            fees: fees,
            payoutMethod: payoutMethod,
            estimatedArrival: this.getEstimatedArrival(payoutMethod, country),
            status: payoutResult.status
        };
    }

    async validatePayoutRequest(payoutRequest) {
        const errors = [];

        // Validate amount
        if (payoutRequest.amount <= 0) {
            errors.push('Amount must be positive');
        }

        // Validate payout method
        if (!this.supportedMethods.includes(payoutRequest.payoutMethod)) {
            errors.push(`Unsupported payout method: ${payoutRequest.payoutMethod}`);
        }

        // Validate country restrictions
        if (!this.isPayoutAvailable(payoutRequest.payoutMethod, payoutRequest.country)) {
            errors.push(`Payout method ${payoutRequest.payoutMethod} not available in ${payoutRequest.country}`);
        }

        // Check minimum amount
        const minAmount = this.getMinimumPayout(payoutRequest.payoutMethod);
        if (payoutRequest.amount < minAmount) {
            errors.push(`Minimum payout amount for ${payoutRequest.payoutMethod} is ${minAmount}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    isPayoutAvailable(method, country) {
        const restrictions = {
            'paypal': ['US', 'CA', 'EU', 'AU', 'ZA'], // PayPal available countries
            'fnb': ['ZA', 'NA', 'BW'], // FNB available countries
            'binance': ['US', 'EU', 'ZA', 'AU'], // Binance available countries
            'wire_transfer': 'all' // Available everywhere
        };

        return restrictions[method] === 'all' || restrictions[method]?.includes(country);
    }

    getMinimumPayout(method) {
        const minimums = {
            'paypal': 10,
            'fnb': 100,
            'binance': 50,
            'wire_transfer': 500
        };

        return minimums[method] || 10;
    }

    async convertCurrency(amount, fromCurrency, toMethod) {
        // Determine target currency based on payout method
        const targetCurrency = this.getPayoutCurrency(toMethod);
        
        if (fromCurrency === targetCurrency) {
            return amount;
        }

        // Use exchange rate API
        try {
            const response = await axios.get(
                `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
            );
            const rate = response.data.rates[targetCurrency];
            return amount * rate;
        } catch (error) {
            console.error('Currency conversion failed:', error);
            // Fallback rates
            const fallbackRates = {
                'USD': 1,
                'ZAR': 18.5,
                'EUR': 0.92
            };
            return amount * (fallbackRates[targetCurrency] / fallbackRates[fromCurrency]);
        }
    }

    getPayoutCurrency(method) {
        const currencies = {
            'paypal': 'USD',
            'fnb': 'ZAR',
            'binance': 'USDT',
            'wire_transfer': 'USD'
        };

        return currencies[method] || 'USD';
    }

    calculatePayoutFees(amount, method, country) {
        const baseFees = {
            'paypal': { percentage: 0.029, fixed: 0.30 }, // 2.9% + $0.30
            'fnb': { percentage: 0.015, fixed: 15 }, // 1.5% + R15
            'binance': { percentage: 0.001, fixed: 1 }, // 0.1% + $1
            'wire_transfer': { percentage: 0.01, fixed: 25 } // 1% + $25
        };

        const feeStructure = baseFees[method] || baseFees.paypal;
        const percentageFee = amount * feeStructure.percentage;
        const totalFee = percentageFee + feeStructure.fixed;

        // Additional cross-border fees
        const crossBorderFee = country !== 'US' ? amount * 0.01 : 0;

        return {
            percentage: feeStructure.percentage,
            fixed: feeStructure.fixed,
            crossBorder: crossBorderFee,
            total: totalFee + crossBorderFee
        };
    }

    async executePayout(payoutDetails) {
        const { payoutMethod, amount, userId, country } = payoutDetails;

        switch (payoutMethod) {
            case 'paypal':
                return await this.executePayPalPayout(payoutDetails);
            case 'fnb':
                return await this.executeFNBPayout(payoutDetails);
            case 'binance':
                return await this.executeBinancePayout(payoutDetails);
            case 'wire_transfer':
                return await this.executeWireTransfer(payoutDetails);
            default:
                throw new Error(`Unsupported payout method: ${payoutMethod}`);
        }
    }

    async executePayPalPayout(details) {
        const payoutDistributor = new PaymentDistributor();
        
        try {
            // Use the existing PayPal payout logic
            const result = await payoutDistributor.payoutToPayPal(details.amount);
            return {
                reference: result.batch_id,
                status: 'COMPLETED',
                method: 'paypal'
            };
        } catch (error) {
            throw new Error(`PayPal payout failed: ${error.message}`);
        }
    }

    async executeFNBPayout(details) {
        const payoutDistributor = new PaymentDistributor();
        
        try {
            const result = await payoutDistributor.payoutToFNB(details.amount);
            return {
                reference: result.transfer_id,
                status: 'COMPLETED',
                method: 'fnb'
            };
        } catch (error) {
            throw new Error(`FNB payout failed: ${error.message}`);
        }
    }

    async executeBinancePayout(details) {
        const payoutDistributor = new PaymentDistributor();
        
        try {
            const result = await payoutDistributor.payoutToBinance(details.amount);
            return {
                reference: `BINANCE_${Date.now()}`,
                status: 'COMPLETED',
                method: 'binance'
            };
        } catch (error) {
            throw new Error(`Binance payout failed: ${error.message}`);
        }
    }

    async executeWireTransfer(details) {
        // Simulate wire transfer processing
        console.log(`Processing wire transfer of $${details.amount} to user ${details.userId}`);
        
        // In reality, this would integrate with banking APIs
        return {
            reference: `WIRE_${Date.now()}`,
            status: 'PROCESSING',
            method: 'wire_transfer',
            note: 'Wire transfers typically take 3-5 business days'
        };
    }

    getEstimatedArrival(method, country) {
        const arrivalTimes = {
            'paypal': 'Instant to 24 hours',
            'fnb': 'Instant to 2 hours',
            'binance': 'Instant to 1 hour',
            'wire_transfer': '3-5 business days'
        };

        return arrivalTimes[method] || 'Unknown';
    }

    async recordPayoutTransaction(transaction) {
        const db = require('../src/services/database/mysql-connector');
        
        try {
            await db.execute(
                `INSERT INTO payout_transactions 
                 (user_id, gross_amount, net_amount, fee_amount, payout_method, 
                  country, payout_reference, status, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    transaction.userId,
                    transaction.grossAmount,
                    transaction.netAmount,
                    transaction.fees.total,
                    transaction.payoutMethod,
                    transaction.country,
                    transaction.payoutReference,
                    transaction.status
                ]
            );
        } catch (error) {
            console.error('Failed to record payout transaction:', error);
        }
    }

    async getUserPayoutHistory(userId, limit = 10) {
        const db = require('../src/services/database/mysql-connector');
        
        try {
            const [rows] = await db.execute(
                `SELECT * FROM payout_transactions 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, limit]
            );

            return rows;
        } catch (error) {
            console.error('Failed to get payout history:', error);
            return [];
        }
    }

    async getPayoutMethods(userCountry) {
        return this.supportedMethods
            .filter(method => this.isPayoutAvailable(method, userCountry))
            .map(method => ({
                method: method,
                name: this.getMethodDisplayName(method),
                minAmount: this.getMinimumPayout(method),
                fees: this.calculatePayoutFees(100, method, userCountry), // Example for $100
                estimatedArrival: this.getEstimatedArrival(method, userCountry),
                currency: this.getPayoutCurrency(method)
            }));
    }

    getMethodDisplayName(method) {
        const names = {
            'paypal': 'PayPal',
            'fnb': 'FNB Bank Transfer',
            'binance': 'Binance (USDT)',
            'wire_transfer': 'International Wire Transfer'
        };

        return names[method] || method;
    }
}

module.exports = MultiPayoutManager;
