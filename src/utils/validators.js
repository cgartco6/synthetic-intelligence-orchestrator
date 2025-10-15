class Validators {
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validatePassword(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        const errors = [];

        if (password.length < minLength) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!hasUpperCase) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!hasLowerCase) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!hasNumbers) {
            errors.push('Password must contain at least one number');
        }
        if (!hasSpecialChar) {
            errors.push('Password must contain at least one special character');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static validateSubscriptionTier(tier) {
        const validTiers = ['free', 'basic', 'premium', 'enterprise'];
        return validTiers.includes(tier);
    }

    static validateTaskType(taskType) {
        const validTypes = ['text', 'image', 'code', 'research', 'analysis', 'voice'];
        return validTypes.includes(taskType);
    }

    static validateCountryCode(countryCode) {
        const validCountryCodes = [
            'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES', 'ZA', 'NA', 'BW',
            'AU', 'JP', 'CN', 'IN', 'BR', 'MX', 'NL', 'SE', 'NO', 'DK'
        ];
        return validCountryCodes.includes(countryCode.toUpperCase());
    }

    static validateCurrency(currency) {
        const validCurrencies = ['USD', 'ZAR', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'INR'];
        return validCurrencies.includes(currency.toUpperCase());
    }

    static validatePaymentAmount(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) {
            return { valid: false, error: 'Amount must be a valid number' };
        }

        if (amount <= 0) {
            return { valid: false, error: 'Amount must be greater than 0' };
        }

        if (amount > 1000000) { // $1,000,000 maximum
            return { valid: false, error: 'Amount exceeds maximum limit' };
        }

        return { valid: true };
    }

    static validateUserData(userData) {
        const errors = [];

        if (!userData.email) {
            errors.push('Email is required');
        } else if (!this.validateEmail(userData.email)) {
            errors.push('Invalid email format');
        }

        if (!userData.password) {
            errors.push('Password is required');
        } else {
            const passwordValidation = this.validatePassword(userData.password);
            if (!passwordValidation.valid) {
                errors.push(...passwordValidation.errors);
            }
        }

        if (userData.firstName && userData.firstName.length > 100) {
            errors.push('First name must be less than 100 characters');
        }

        if (userData.lastName && userData.lastName.length > 100) {
            errors.push('Last name must be less than 100 characters');
        }

        if (userData.country && !this.validateCountryCode(userData.country)) {
            errors.push('Invalid country code');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static validateTaskData(taskData) {
        const errors = [];

        if (!taskData.type) {
            errors.push('Task type is required');
        } else if (!this.validateTaskType(taskData.type)) {
            errors.push('Invalid task type');
        }

        if (!taskData.prompt && !taskData.data) {
            errors.push('Task prompt or data is required');
        }

        if (taskData.prompt && taskData.prompt.length > 10000) {
            errors.push('Task prompt must be less than 10,000 characters');
        }

        if (taskData.options && typeof taskData.options !== 'object') {
            errors.push('Task options must be an object');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static validateAdCampaignData(campaignData) {
        const errors = [];

        if (!campaignData.name) {
            errors.push('Campaign name is required');
        }

        if (!campaignData.advertiser) {
            errors.push('Advertiser name is required');
        }

        if (!campaignData.cpm || campaignData.cpm <= 0) {
            errors.push('Valid CPM rate is required');
        }

        if (!campaignData.duration || campaignData.duration <= 0) {
            errors.push('Valid ad duration is required');
        }

        if (!campaignData.targetAudience || !Array.isArray(campaignData.targetAudience)) {
            errors.push('Target audience must be an array');
        }

        if (!campaignData.contentUrl) {
            errors.push('Content URL is required');
        }

        if (!campaignData.startDate) {
            errors.push('Start date is required');
        }

        if (!campaignData.budget || campaignData.budget <= 0) {
            errors.push('Valid budget is required');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static validatePayoutRequest(payoutData) {
        const errors = [];

        if (!payoutData.amount || payoutData.amount <= 0) {
            errors.push('Valid amount is required');
        }

        if (!payoutData.payoutMethod) {
            errors.push('Payout method is required');
        }

        const validMethods = ['paypal', 'fnb', 'binance', 'wire_transfer'];
        if (!validMethods.includes(payoutData.payoutMethod)) {
            errors.push('Invalid payout method');
        }

        if (payoutData.currency && !this.validateCurrency(payoutData.currency)) {
            errors.push('Invalid currency');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    static sanitizeString(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/\\/g, '&#x5C;')
            .replace(/`/g, '&#96;')
            .trim();
    }

    static sanitizeObject(obj) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    static validateAPIKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }

        // Basic API key validation - adjust based on your API key format
        const apiKeyRegex = /^[A-Za-z0-9_-]{20,}$/;
        return apiKeyRegex.test(apiKey);
    }

    static validateIPAddress(ip) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    static validateUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    static validateCreditCard(number) {
        // Luhn algorithm implementation
        let sum = 0;
        let isEven = false;
        
        for (let i = number.length - 1; i >= 0; i--) {
            let digit = parseInt(number.charAt(i), 10);
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        return (sum % 10) === 0;
    }

    static validatePhoneNumber(phone) {
        // Basic international phone number validation
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    static validateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { valid: false, error: 'Invalid date format' };
        }
        
        if (start > end) {
            return { valid: false, error: 'Start date must be before end date' };
        }
        
        return { valid: true };
    }

    static validateFileType(filename, allowedTypes) {
        const extension = filename.split('.').pop().toLowerCase();
        return allowedTypes.includes(extension);
    }

    static validateFileSize(fileSize, maxSize) {
        return fileSize <= maxSize;
    }

    static validateJSON(jsonString) {
        try {
            JSON.parse(jsonString);
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = Validators;
