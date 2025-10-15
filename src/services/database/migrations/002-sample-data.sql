-- Sample data for testing and development

-- Insert sample users
INSERT INTO users (email, password_hash, first_name, last_name, country, subscription_tier) VALUES
('john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0g8f/sOe1e8yb5YQcY92OYEbbJ.Dw.DRDA', 'John', 'Doe', 'US', 'free'),
('jane.smith@example.com', '$2b$12$LQv3c1yqBWVHxkd0g8f/sOe1e8yb5YQcY92OYEbbJ.Dw.DRDA', 'Jane', 'Smith', 'GB', 'basic'),
('mike.wilson@example.com', '$2b$12$LQv3c1yqBWVHxkd0g8f/sOe1e8yb5YQcY92OYEbbJ.Dw.DRDA', 'Mike', 'Wilson', 'ZA', 'premium'),
('sarah.jones@example.com', '$2b$12$LQv3c1yqBWVHxkd0g8f/sOe1e8yb5YQcY92OYEbbJ.Dw.DRDA', 'Sarah', 'Jones', 'AU', 'enterprise');

-- Insert sample subscriptions
INSERT INTO subscriptions (user_id, tier, status, current_period_start, current_period_end) VALUES
(2, 'basic', 'active', DATE_SUB(CURDATE(), INTERVAL 15 DAY), DATE_ADD(CURDATE(), INTERVAL 15 DAY)),
(3, 'premium', 'active', DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
(4, 'enterprise', 'active', DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 25 DAY));

-- Insert sample tasks (with encrypted data - using placeholder encryption)
INSERT INTO tasks (id, user_id, task_type, task_data, result_data, status, ad_served, ad_revenue) VALUES
('task_1', 1, 'text', 'encrypted_task_data_1', 'encrypted_result_data_1', 'completed', TRUE, 2.20),
('task_2', 1, 'image', 'encrypted_task_data_2', 'encrypted_result_data_2', 'completed', TRUE, 2.20),
('task_3', 2, 'code', 'encrypted_task_data_3', 'encrypted_result_data_3', 'completed', FALSE, 0.00),
('task_4', 3, 'research', 'encrypted_task_data_4', 'encrypted_result_data_4', 'completed', TRUE, 1.50),
('task_5', 4, 'analysis', 'encrypted_task_data_5', 'encrypted_result_data_5', 'completed', FALSE, 0.00);

-- Insert sample task usage
INSERT INTO task_usage (user_id, tier, task_type) VALUES
(1, 'free', 'text'),
(1, 'free', 'image'),
(2, 'basic', 'code'),
(3, 'premium', 'research'),
(4, 'enterprise', 'analysis');

-- Insert sample payments
INSERT INTO payments (user_id, subscription_id, payment_id, amount, currency, status, payment_method) VALUES
(2, 1, 'pay_1', 19.00, 'USD', 'completed', 'stripe'),
(3, 2, 'pay_2', 39.00, 'USD', 'completed', 'stripe'),
(4, 3, 'pay_3', 59.00, 'USD', 'completed', 'stripe');

-- Insert sample ad impressions
INSERT INTO ad_impressions (campaign_id, user_id, tracking_id, revenue, completed, impression_date) VALUES
(1, 1, 'track_1', 2.20, TRUE, CURDATE()),
(1, 1, 'track_2', 2.20, TRUE, CURDATE()),
(2, 3, 'track_3', 1.50, TRUE, CURDATE());

-- Insert sample security audit logs
INSERT INTO security_audit_log (user_id, action, resource, ip_address, status) VALUES
(1, 'LOGIN_ATTEMPT', 'AUTH', '192.168.1.100', 'SUCCESS'),
(2, 'SUBSCRIPTION_UPGRADE', 'SUBSCRIPTION', '192.168.1.101', 'SUCCESS'),
(3, 'TASK_PROCESSING', 'AGENTS', '192.168.1.102', 'SUCCESS');
