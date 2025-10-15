// AI Orchestrator Frontend Application
class AIOrchestratorApp {
    constructor() {
        this.currentUser = null;
        this.authToken = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDemoAnimation();
        this.checkAuthentication();
        this.setupPricingToggle();
        this.setupMobileNavigation();
        this.setupSmoothScrolling();
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Auth forms
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Task submission
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => this.handleTaskSubmission(e));
        }

        // Subscription management
        const upgradeButtons = document.querySelectorAll('.upgrade-btn');
        upgradeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUpgrade(e));
        });

        // Ad completion tracking
        const adVideos = document.querySelectorAll('.ad-video');
        adVideos.forEach(video => {
            video.addEventListener('ended', (e) => this.trackAdCompletion(e));
        });
    }

    // Mobile Navigation
    setupMobileNavigation() {
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
            });

            // Close menu when clicking on a link
            const navLinks = navMenu.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                });
            });
        }
    }

    // Smooth Scrolling
    setupSmoothScrolling() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    // Pricing Toggle
    setupPricingToggle() {
        const billingToggle = document.getElementById('billingToggle');
        const monthlyPrices = document.querySelectorAll('.price.monthly');
        const yearlyPrices = document.querySelectorAll('.price.yearly');

        if (billingToggle) {
            billingToggle.addEventListener('change', (e) => {
                const isYearly = e.target.checked;
                
                monthlyPrices.forEach(price => {
                    price.style.display = isYearly ? 'none' : 'flex';
                });
                
                yearlyPrices.forEach(price => {
                    price.style.display = isYearly ? 'flex' : 'none';
                });

                // Update amounts for yearly billing (20% discount)
                if (isYearly) {
                    this.updatePricesForYearlyBilling();
                } else {
                    this.updatePricesForMonthlyBilling();
                }
            });
        }
    }

    updatePricesForYearlyBilling() {
        const prices = {
            'basic': 15.20,   // $19 * 0.8
            'premium': 31.20, // $39 * 0.8
            'enterprise': 47.20 // $59 * 0.8
        };

        Object.keys(prices).forEach(tier => {
            const elements = document.querySelectorAll(`[data-tier="${tier}"] .amount`);
            elements.forEach(element => {
                element.textContent = prices[tier];
            });
        });
    }

    updatePricesForMonthlyBilling() {
        const prices = {
            'basic': 19,
            'premium': 39,
            'enterprise': 59
        };

        Object.keys(prices).forEach(tier => {
            const elements = document.querySelectorAll(`[data-tier="${tier}"] .amount`);
            elements.forEach(element => {
                element.textContent = prices[tier];
            });
        });
    }

    // Demo Animation
    setupDemoAnimation() {
        const agents = document.querySelectorAll('.ai-agent');
        let currentAgent = 0;

        if (agents.length > 0) {
            setInterval(() => {
                agents.forEach(agent => agent.classList.remove('active'));
                agents[currentAgent].classList.add('active');
                currentAgent = (currentAgent + 1) % agents.length;
            }, 3000);
        }
    }

    // Authentication Methods
    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('email'),
            password: formData.get('password')
        };

        try {
            const response = await this.apiCall('/api/auth/login', 'POST', credentials);
            
            if (response.success) {
                this.authToken = response.token;
                localStorage.setItem('authToken', this.authToken);
                this.currentUser = response.user;
                this.showNotification('Login successful!', 'success');
                window.location.href = '/dashboard';
            } else {
                this.showNotification(response.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Login failed. Please try again.', 'error');
            console.error('Login error:', error);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            email: formData.get('email'),
            password: formData.get('password'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            country: formData.get('country') || 'US'
        };

        try {
            const response = await this.apiCall('/api/auth/register', 'POST', userData);
            
            if (response.success) {
                this.showNotification('Registration successful!', 'success');
                // Auto-login after registration
                await this.handleLogin(e);
            } else {
                this.showNotification(response.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
            console.error('Registration error:', error);
        }
    }

    async checkAuthentication() {
        if (this.authToken) {
            try {
                const response = await this.apiCall('/api/auth/profile', 'GET');
                if (response.success) {
                    this.currentUser = response.user;
                    this.updateUIForAuthenticatedUser();
                } else {
                    this.handleLogout();
                }
            } catch (error) {
                this.handleLogout();
            }
        }
    }

    handleLogout() {
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('authToken');
        this.updateUIForUnauthenticatedUser();
    }

    // Task Management
    async handleTaskSubmission(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
            type: formData.get('taskType'),
            prompt: formData.get('prompt'),
            options: {
                // Additional options based on task type
            }
        };

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
            submitBtn.classList.add('loading');

            const response = await this.apiCall('/api/agents/process', 'POST', { task: taskData });

            if (response.success) {
                this.showNotification('Task submitted successfully!', 'success');
                this.displayTaskResult(response);
                
                // Check if ad is required
                if (response.adRequired) {
                    await this.showAd(response.adData);
                }
            } else {
                this.showNotification(response.error || 'Task failed', 'error');
            }
        } catch (error) {
            this.showNotification('Task submission failed', 'error');
            console.error('Task error:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.classList.remove('loading');
        }
    }

    displayTaskResult(result) {
        const resultsContainer = document.getElementById('taskResults');
        if (resultsContainer) {
            const resultElement = document.createElement('div');
            resultElement.className = 'task-result';
            resultElement.innerHTML = `
                <div class="result-header">
                    <h4>Task Completed</h4>
                    <span class="task-type">${result.taskType}</span>
                </div>
                <div class="result-content">
                    ${this.formatTaskResult(result)}
                </div>
                <div class="result-meta">
                    <span>Completed at: ${new Date().toLocaleString()}</span>
                </div>
            `;
            resultsContainer.prepend(resultElement);
        }
    }

    formatTaskResult(result) {
        switch (result.taskType) {
            case 'text':
            case 'research':
            case 'analysis':
                return `<div class="text-result">${result.content}</div>`;
            case 'code':
                return `<pre><code>${result.code}</code></pre>`;
            case 'image':
                return `<img src="data:image/png;base64,${result.image.base64}" alt="Generated image">`;
            case 'voice':
                return `
                    <audio controls>
                        <source src="data:audio/mp3;base64,${result.audio.base64}" type="audio/mp3">
                    </audio>
                `;
            default:
                return `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        }
    }

    // Ad Management
    async showAd(adData) {
        return new Promise((resolve) => {
            const adModal = document.createElement('div');
            adModal.className = 'ad-modal';
            adModal.innerHTML = `
                <div class="ad-modal-content">
                    <div class="ad-header">
                        <h3>Advertisement</h3>
                        <span class="ad-timer">30</span>
                    </div>
                    <div class="ad-video-container">
                        <video class="ad-video" controls autoplay>
                            <source src="${adData.adContent}" type="video/mp4">
                        </video>
                    </div>
                    <div class="ad-footer">
                        <p>Please watch this 30-second ad to continue</p>
                    </div>
                </div>
            `;

            document.body.appendChild(adModal);

            const video = adModal.querySelector('.ad-video');
            const timer = adModal.querySelector('.ad-timer');
            let timeLeft = 30;

            const timerInterval = setInterval(() => {
                timeLeft--;
                timer.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                }
            }, 1000);

            video.addEventListener('ended', () => {
                clearInterval(timerInterval);
                this.trackAdCompletion(adData.trackingId);
                document.body.removeChild(adModal);
                resolve();
            });

            // Handle skip if allowed
            if (adData.skipable) {
                const skipBtn = document.createElement('button');
                skipBtn.className = 'ad-skip-btn';
                skipBtn.textContent = 'Skip Ad';
                skipBtn.addEventListener('click', () => {
                    clearInterval(timerInterval);
                    document.body.removeChild(adModal);
                    resolve();
                });
                adModal.querySelector('.ad-footer').appendChild(skipBtn);
            }
        });
    }

    async trackAdCompletion(trackingId) {
        try {
            await this.apiCall('/api/ads/complete', 'POST', { trackingId });
        } catch (error) {
            console.error('Ad tracking error:', error);
        }
    }

    // Subscription Management
    async handleUpgrade(e) {
        e.preventDefault();
        const tier = e.target.dataset.tier;
        
        if (!this.currentUser) {
            this.showNotification('Please log in to upgrade your subscription', 'warning');
            window.location.href = '/login';
            return;
        }

        try {
            const response = await this.apiCall('/api/subscription/upgrade', 'POST', { tier });
            
            if (response.success) {
                if (response.action === 'checkout_required') {
                    // Redirect to checkout
                    await this.initiateCheckout(tier, response);
                } else {
                    this.showNotification('Subscription upgraded successfully!', 'success');
                    this.currentUser.subscriptionTier = tier;
                    this.updateUIForAuthenticatedUser();
                }
            } else {
                this.showNotification(response.error || 'Upgrade failed', 'error');
            }
        } catch (error) {
            this.showNotification('Upgrade failed. Please try again.', 'error');
            console.error('Upgrade error:', error);
        }
    }

    async initiateCheckout(tier, checkoutData) {
        // This would integrate with Stripe or PayFast
        // For now, show a confirmation modal
        this.showCheckoutModal(tier, checkoutData);
    }

    showCheckoutModal(tier, checkoutData) {
        const modal = document.createElement('div');
        modal.className = 'checkout-modal';
        modal.innerHTML = `
            <div class="checkout-modal-content">
                <h3>Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}</h3>
                <div class="checkout-details">
                    <p>Amount: ${checkoutData.symbol}${checkoutData.price}</p>
                    <p>Currency: ${checkoutData.currency}</p>
                </div>
                <div class="checkout-actions">
                    <button class="btn btn-outline" id="cancelCheckout">Cancel</button>
                    <button class="btn btn-primary" id="confirmCheckout">Proceed to Payment</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#cancelCheckout').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('#confirmCheckout').addEventListener('click', () => {
            // In a real implementation, this would redirect to payment gateway
            this.showNotification('Redirecting to payment gateway...', 'info');
            document.body.removeChild(modal);
        });
    }

    // API Communication
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(endpoint, options);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'API request failed');
            }
            
            return result;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    // UI Updates
    updateUIForAuthenticatedUser() {
        // Update navigation
        const authElements = document.querySelectorAll('.auth-required');
        const unauthElements = document.querySelectorAll('.unauth-required');
        
        authElements.forEach(el => el.style.display = 'block');
        unauthElements.forEach(el => el.style.display = 'none');

        // Update user info
        const userElements = document.querySelectorAll('.user-info');
        userElements.forEach(el => {
            el.textContent = this.currentUser.email;
        });

        // Update subscription info
        const tierElements = document.querySelectorAll('.subscription-tier');
        tierElements.forEach(el => {
            el.textContent = this.currentUser.subscriptionTier;
        });
    }

    updateUIForUnauthenticatedUser() {
        const authElements = document.querySelectorAll('.auth-required');
        const unauthElements = document.querySelectorAll('.unauth-required');
        
        authElements.forEach(el => el.style.display = 'none');
        unauthElements.forEach(el => el.style.display = 'block');
    }

    // Notification System
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Utility Methods
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiOrchestrator = new AIOrchestratorApp();
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIOrchestratorApp;
}
