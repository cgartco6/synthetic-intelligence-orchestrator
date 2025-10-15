-- Initial Database Schema for AI Orchestrator
-- This schema supports the multi-tier subscription model with ad integration

SET FOREIGN_KEY_CHECKS=0;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    country VARCHAR(2) DEFAULT 'US',
    timezone VARCHAR(50) DEFAULT 'UTC',
    subscription_tier ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
    subscription_status ENUM('active', 'canceled', 'past_due') DEFAULT 'active',
    tasks_today INT DEFAULT 0,
    last_task_date DATE,
    ads_today INT DEFAULT 0,
    last_ad_date DATE,
    total_ads INT DEFAULT 0,
    last_ad_task_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_subscription (subscription_tier, subscription_status),
    INDEX idx_country (country)
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    tier ENUM('free', 'basic', 'premium', 'enterprise') NOT NULL,
    stripe_subscription_id VARCHAR(255),
    payfast_subscription_id VARCHAR(255),
    status ENUM('active', 'canceled', 'past_due', 'inactive') DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_stripe (stripe_subscription_id),
    INDEX idx_payfast (payfast_subscription_id)
);

-- Tasks table
CREATE TABLE tasks (
    id VARCHAR(100) PRIMARY KEY,
    user_id INT NOT NULL,
    task_type ENUM('text', 'image', 'code', 'research', 'analysis', 'voice') NOT NULL,
    task_data TEXT NOT NULL, -- Encrypted task data
    result_data TEXT, -- Encrypted result data
    status ENUM('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
    ad_served BOOLEAN DEFAULT FALSE,
    ad_campaign_id VARCHAR(255),
    ad_revenue DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_task_type (task_type),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
);

-- Task usage tracking
CREATE TABLE task_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    tier ENUM('free', 'basic', 'premium', 'enterprise') NOT NULL,
    task_type ENUM('text', 'image', 'code', 'research', 'analysis', 'voice') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, created_at),
    INDEX idx_tier_type (tier, task_type)
);

-- Payments table
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    subscription_id INT,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_status (status)
);

-- Payout transactions
CREATE TABLE payout_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    fee_amount DECIMAL(10,2) NOT NULL,
    payout_method ENUM('paypal', 'fnb', 'binance', 'wire_transfer') NOT NULL,
    country VARCHAR(2) NOT NULL,
    payout_reference VARCHAR(255) NOT NULL,
    status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_payout_method (payout_method),
    INDEX idx_status (status)
);

-- Revenue distributions
CREATE TABLE revenue_distributions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    total_revenue DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    net_revenue DECIMAL(10,2) NOT NULL,
    owner_share DECIMAL(10,2) NOT NULL,
    platform_share DECIMAL(10,2) NOT NULL,
    paypal_amount DECIMAL(10,2) NOT NULL,
    fnb_amount DECIMAL(10,2) NOT NULL,
    binance_amount DECIMAL(10,2) NOT NULL,
    country VARCHAR(2) NOT NULL,
    distribution_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_distribution_date (distribution_date),
    INDEX idx_country (country)
);

-- Ad campaigns table
CREATE TABLE ad_campaigns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    advertiser VARCHAR(255) NOT NULL,
    cpm DECIMAL(10,2) NOT NULL, -- Cost per thousand impressions
    duration INT NOT NULL, -- Duration in seconds
    target_audience JSON NOT NULL, -- JSON array of target tiers
    content_url VARCHAR(500) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    budget DECIMAL(10,2) NOT NULL,
    status ENUM('active', 'paused', 'completed', 'cancelled') DEFAULT 'active',
    impressions INT DEFAULT 0,
    completions INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_cpm (cpm DESC)
);

-- Ad impressions table
CREATE TABLE ad_impressions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campaign_id INT NOT NULL,
    user_id INT NOT NULL,
    tracking_id VARCHAR(255) UNIQUE,
    revenue DECIMAL(10,4) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    impression_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_user_id (user_id),
    INDEX idx_impression_date (impression_date),
    INDEX idx_tracking (tracking_id)
);

-- Security audit log
CREATE TABLE security_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status ENUM('SUCCESS', 'FAILED', 'ERROR', 'REQUEST') NOT NULL,
    details JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp),
    INDEX idx_status (status)
);

-- System settings (for configuration)
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSON NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
);

SET FOREIGN_KEY_CHECKS=1;

-- Insert initial system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('ad_frequency', '{"free": 2, "basic": 5, "premium": 200, "enterprise": 0}', 'Number of tasks between ads for each tier'),
('task_limits', '{"free": {"text": 5, "image": 1, "code": 1, "research": 1, "analysis": 1, "voice": 0}, "basic": {"text": 50, "image": 10, "code": 10, "research": 10, "analysis": 10, "voice": 5}, "premium": {"text": 200, "image": 50, "code": 50, "research": 50, "analysis": 50, "voice": 20}, "enterprise": {"text": -1, "image": -1, "code": -1, "research": -1, "analysis": -1, "voice": -1}}', 'Daily task limits for each tier'),
('currency_rates', '{"USD": 1, "ZAR": 18.5, "EUR": 0.92, "GBP": 0.79, "JPY": 150, "AUD": 1.52, "CAD": 1.35, "INR": 83}', 'Currency conversion rates'),
('compliance_settings', '{"gdpr_enabled": true, "popia_enabled": true, "data_retention_days": 730}', 'Compliance and data retention settings');

-- Insert sample ad campaigns
INSERT INTO ad_campaigns (name, advertiser, cpm, duration, target_audience, content_url, start_date, end_date, budget) VALUES
('Luxury Tech Solutions', 'TechInnovate Inc', 2200.00, 30, '["free", "basic", "premium"]', 'https://cdn.example.com/ads/luxury-tech.mp4', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 10000.00),
('Premium Financial Services', 'WealthBuild Partners', 1500.00, 30, '["basic", "premium"]', 'https://cdn.example.com/ads/financial-services.mp4', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 60 DAY), 15000.00),
('AI Tools Platform', 'AITools Co', 800.00, 30, '["free", "basic", "premium"]', 'https://cdn.example.com/ads/ai-tools.mp4', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY), 5000.00),
('Enterprise SaaS', 'BusinessCloud Solutions', 600.00, 30, '["free", "basic", "premium"]', 'https://cdn.example.com/ads/enterprise-saas.mp4', CURDATE(), NULL, 20000.00);
