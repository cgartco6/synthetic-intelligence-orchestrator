const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    init() {
        // Using Afrihost email services
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'mail.afrihost.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendWelcomeEmail(user) {
        const subject = 'Welcome to AI Orchestrator!';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Welcome to AI Orchestrator! 🚀</h1>
                <p>Hello ${user.firstName || 'there'},</p>
                <p>Thank you for joining AI Orchestrator - your gateway to powerful AI content generation!</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #333;">What you can do with your free account:</h3>
                    <ul>
                        <li>5 text generation tasks daily</li>
                        <li>1 image generation task daily</li>
                        <li>1 code generation task daily</li>
                        <li>1 research task daily</li>
                        <li>1 analysis task daily</li>
                    </ul>
                </div>

                <p>Ready to get started? <a href="${process.env.APP_URL}/dashboard" style="color: #007bff;">Launch your first AI task</a></p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        Need help? Contact our support team at <a href="mailto:support@ai-orchestrator.com">support@ai-orchestrator.com</a>
                    </p>
                </div>
            </div>
        `;

        return await this.sendEmail(user.email, subject, html);
    }

    async sendSubscriptionConfirmation(user, subscription) {
        const subject = `Subscription Confirmed - ${subscription.tier} Plan`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Subscription Confirmed! 🎉</h1>
                <p>Hello ${user.firstName || 'there'},</p>
                <p>Your ${subscription.tier} subscription has been successfully activated.</p>
                
                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2d5016;">Subscription Details:</h3>
                    <p><strong>Plan:</strong> ${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}</p>
                    <p><strong>Status:</strong> Active</p>
                    <p><strong>Next Billing Date:</strong> ${new Date(subscription.current_period_end).toLocaleDateString()}</p>
                </div>

                <p>You now have access to all ${subscription.tier} features. <a href="${process.env.APP_URL}/dashboard" style="color: #007bff;">Start creating</a></p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        Manage your subscription in your <a href="${process.env.APP_URL}/account">account settings</a>.
                    </p>
                </div>
            </div>
        `;

        return await this.sendEmail(user.email, subject, html);
    }

    async sendPasswordResetEmail(user, resetToken) {
        const subject = 'Password Reset Request';
        const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Password Reset</h1>
                <p>Hello ${user.firstName || 'there'},</p>
                <p>We received a request to reset your password for your AI Orchestrator account.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Your Password
                    </a>
                </div>

                <p style="color: #666; font-size: 14px;">
                    This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        If the button doesn't work, copy and paste this link in your browser:<br>
                        ${resetUrl}
                    </p>
                </div>
            </div>
        `;

        return await this.sendEmail(user.email, subject, html);
    }

    async sendPaymentReceipt(user, payment) {
        const subject = 'Payment Receipt';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Payment Confirmed</h1>
                <p>Hello ${user.firstName || 'there'},</p>
                <p>Thank you for your payment. Here's your receipt:</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #333;">Payment Details:</h3>
                    <p><strong>Amount:</strong> ${payment.currency} ${payment.amount}</p>
                    <p><strong>Date:</strong> ${new Date(payment.payment_date).toLocaleDateString()}</p>
                    <p><strong>Payment ID:</strong> ${payment.payment_id}</p>
                    <p><strong>Status:</strong> ${payment.status}</p>
                </div>

                <p>You can view your payment history in your <a href="${process.env.APP_URL}/account/billing" style="color: #007bff;">account settings</a>.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        If you have any questions about this payment, please contact our support team.
                    </p>
                </div>
            </div>
        `;

        return await this.sendEmail(user.email, subject, html);
    }

    async sendAdminAlert(subject, message, level = 'info') {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) {
            console.warn('Admin email not configured');
            return;
        }

        const color = {
            info: '#007bff',
            warning: '#ffc107',
            error: '#dc3545',
            success: '#28a745'
        }[level] || '#007bff';

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: ${color};">Admin Alert: ${subject}</h1>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;">${message}</p>
                </div>
                <p style="color: #666; font-size: 12px;">
                    This is an automated alert from AI Orchestrator system.
                </p>
            </div>
        `;

        return await this.sendEmail(adminEmail, `[AI Orchestrator] ${subject}`, html);
    }

    async sendEmail(to, subject, html, text = null) {
        try {
            if (!text) {
                // Create plain text version from HTML
                text = html.replace(/<[^>]*>/g, '');
            }

            const mailOptions = {
                from: `"AI Orchestrator" <${process.env.EMAIL_FROM || 'noreply@ai-orchestrator.com'}>`,
                to: to,
                subject: subject,
                text: text,
                html: html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Email sent to ${to}: ${result.messageId}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('Email service connection verified');
            return true;
        } catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }
}

module.exports = EmailService;
