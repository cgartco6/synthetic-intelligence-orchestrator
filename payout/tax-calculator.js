class TaxCalculator {
    constructor() {
        this.taxRates = this.loadTaxRates();
        this.taxTreaties = this.loadTaxTreaties();
    }

    loadTaxRates() {
        return {
            // North America
            'US': { rate: 0.00, type: 'sales_tax' }, // Sales tax varies by state
            'CA': { rate: 0.05, type: 'gst' }, // GST
            'MX': { rate: 0.16, type: 'vat' },
            
            // Europe
            'DE': { rate: 0.19, type: 'vat' }, // Germany
            'FR': { rate: 0.20, type: 'vat' }, // France
            'GB': { rate: 0.20, type: 'vat' }, // UK
            'IT': { rate: 0.22, type: 'vat' }, // Italy
            'ES': { rate: 0.21, type: 'vat' }, // Spain
            'NL': { rate: 0.21, type: 'vat' }, // Netherlands
            
            // Southern Africa
            'ZA': { rate: 0.15, type: 'vat' }, // South Africa
            'NA': { rate: 0.15, type: 'vat' }, // Namibia
            'BW': { rate: 0.14, type: 'vat' }, // Botswana
            
            // Asia Pacific
            'AU': { rate: 0.10, type: 'gst' }, // Australia
            'NZ': { rate: 0.15, type: 'gst' }, // New Zealand
            'JP': { rate: 0.10, type: 'consumption_tax' }, // Japan
            'SG': { rate: 0.09, type: 'gst' }, // Singapore
            'IN': { rate: 0.18, type: 'gst' }, // India
            
            // South America
            'BR': { rate: 0.17, type: 'icms' }, // Brazil
            'AR': { rate: 0.21, type: 'vat' }, // Argentina
            
            // Default
            'default': { rate: 0.00, type: 'none' }
        };
    }

    loadTaxTreaties() {
        return {
            'US': { withholding_tax: 0.30, reduced_rate: 0.00 }, // No reduced rate for digital services
            'CA': { withholding_tax: 0.25, reduced_rate: 0.00 },
            'EU': { withholding_tax: 0.00, reduced_rate: 0.00 }, // VAT instead
            'default': { withholding_tax: 0.15, reduced_rate: 0.00 }
        };
    }

    calculateTax(amount, countryCode, isBusiness = false) {
        const taxInfo = this.taxRates[countryCode] || this.taxRates.default;
        
        let taxAmount = 0;
        
        if (taxInfo.type === 'vat' || taxInfo.type === 'gst') {
            // VAT/GST applies to B2C transactions
            if (!isBusiness) {
                taxAmount = amount * taxInfo.rate;
            }
        } else if (taxInfo.type === 'sales_tax') {
            // US sales tax - would need state-level calculation
            taxAmount = this.calculateUSTax(amount, countryCode);
        }
        
        return {
            amount: taxAmount,
            rate: taxInfo.rate,
            type: taxInfo.type,
            country: countryCode
        };
    }

    calculateUSTax(amount, countryCode) {
        // Simplified US sales tax calculation
        // In reality, this would need to handle state and local taxes
        const stateRates = {
            'CA': 0.0725, // California
            'NY': 0.0400, // New York
            'TX': 0.0625, // Texas
            'FL': 0.0600, // Florida
            'default': 0.0550 // Average US rate
        };
        
        const state = countryCode; // In US context, countryCode would be state code
        const rate = stateRates[state] || stateRates.default;
        
        return amount * rate;
    }

    calculateWithholdingTax(amount, countryCode) {
        const treaty = this.taxTreaties[countryCode] || this.taxTreaties.default;
        return amount * treaty.withholding_tax;
    }

    async generateTaxInvoice(transaction) {
        const {
            amount,
            countryCode,
            customerType,
            transactionId,
            date
        } = transaction;

        const tax = this.calculateTax(amount, countryCode, customerType === 'business');
        
        return {
            invoice_number: `INV-${transactionId}`,
            date: date,
            amount: amount,
            tax_amount: tax.amount,
            total_amount: amount + tax.amount,
            tax_rate: tax.rate,
            tax_type: tax.type,
            country: countryCode,
            currency: 'USD',
            customer_type: customerType,
            tax_id: this.getTaxIdentifier(countryCode)
        };
    }

    getTaxIdentifier(countryCode) {
        const identifiers = {
            'EU': 'EU VAT',
            'ZA': 'VAT No.',
            'AU': 'ABN',
            'NZ': 'GST No.',
            'default': 'Tax ID'
        };
        
        return identifiers[countryCode] || identifiers.default;
    }

    async prepareTaxReport(period) {
        const db = require('../src/services/database/mysql-connector');
        
        try {
            const [transactions] = await db.execute(
                `SELECT country, COUNT(*) as transaction_count, 
                        SUM(amount) as total_amount, SUM(tax_amount) as total_tax
                 FROM payments 
                 WHERE payment_date BETWEEN ? AND ?
                 GROUP BY country`,
                [period.startDate, period.endDate]
            );

            const report = {
                period: period,
                summary: {
                    total_transactions: transactions.reduce((sum, t) => sum + t.transaction_count, 0),
                    total_revenue: transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0),
                    total_tax: transactions.reduce((sum, t) => sum + parseFloat(t.total_tax), 0)
                },
                by_country: transactions.map(t => ({
                    country: t.country,
                    transactions: t.transaction_count,
                    revenue: parseFloat(t.total_amount),
                    tax: parseFloat(t.total_tax)
                }))
            };

            return report;
        } catch (error) {
            console.error('Failed to prepare tax report:', error);
            throw error;
        }
    }

    validateTaxCompliance(countryCode) {
        const requirements = {
            'EU': {
                vat_moss: true,
                threshold: 0, // No threshold for digital services
                filing_frequency: 'quarterly'
            },
            'ZA': {
                vat_registration: true,
                threshold: 50000, // ZAR
                filing_frequency: 'monthly'
            },
            'AU': {
                gst_registration: true,
                threshold: 75000, // AUD
                filing_frequency: 'quarterly'
            },
            'default': {
                vat_registration: false,
                threshold: 0,
                filing_frequency: 'annually'
            }
        };

        return requirements[countryCode] || requirements.default;
    }

    async registerForTax(countryCode) {
        const compliance = this.validateTaxCompliance(countryCode);
        
        if (compliance.vat_registration || compliance.vat_moss) {
            // Initiate tax registration process
            return await this.initiateTaxRegistration(countryCode, compliance);
        }
        
        return {
            required: false,
            message: 'No tax registration required for this jurisdiction'
        };
    }

    async initiateTaxRegistration(countryCode, compliance) {
        // This would integrate with tax authority APIs
        // For now, return simulated response
        return {
            required: true,
            country: countryCode,
            registration_type: compliance.vat_moss ? 'VAT MOSS' : 'VAT',
            threshold: compliance.threshold,
            filing_frequency: compliance.filing_frequency,
            next_steps: [
                'Complete online registration form',
                'Submit business documentation',
                'Await tax identification number'
            ]
        };
    }
}

module.exports = TaxCalculator;
