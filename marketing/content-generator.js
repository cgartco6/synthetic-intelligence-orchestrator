const axios = require('axios');

class ContentGenerator {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.openaiBaseUrl = 'https://api.openai.com/v1';
    }

    async generateAIContent(prompt, contentType = 'social_media') {
        try {
            const response = await axios.post(
                `${this.openaiBaseUrl}/chat/completions`,
                {
                    model: "gpt-4",
                    messages: [
                        {
                            role: "system",
                            content: this.getSystemPrompt(contentType)
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.8
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('AI content generation failed:', error.response?.data || error.message);
            return this.getFallbackContent(contentType);
        }
    }

    getSystemPrompt(contentType) {
        const prompts = {
            social_media: "You are a creative social media manager. Create engaging, viral-style posts that promote an AI content generation platform. Include relevant hashtags and emojis. Keep it concise and exciting.",
            email: "You are a marketing copywriter. Create compelling email content that encourages users to upgrade their subscription. Highlight benefits and include a clear call-to-action.",
            ad_copy: "You are a professional ad copywriter. Create high-converting ad copy for premium AI services. Focus on benefits, urgency, and value proposition."
        };

        return prompts[contentType] || prompts.social_media;
    }

    getFallbackContent(contentType) {
        const fallbacks = {
            social_media: "🚀 Discover the power of AI content generation! Create amazing content in seconds. Try it free now! #AI #Innovation",
            email: "Unlock the full potential of AI content generation. Upgrade your account today for unlimited access to all features!",
            ad_copy: "Transform your content creation with AI. Generate text, images, code, and more in seconds. Start your free trial!"
        };

        return fallbacks[contentType] || fallbacks.social_media;
    }

    async generateMultiplePosts(count = 5, theme = 'AI technology') {
        const posts = [];
        
        for (let i = 0; i < count; i++) {
            const prompt = `Create a social media post about ${theme}. Make it engaging and include relevant hashtags.`;
            const content = await this.generateAIContent(prompt, 'social_media');
            posts.push(content);
        }
        
        return posts;
    }

    async generateEmailCampaign(campaignType, targetAudience) {
        const prompt = `Create an email campaign for ${campaignType} targeting ${targetAudience}. Include subject line and body content.`;
        return await this.generateAIContent(prompt, 'email');
    }
}

module.exports = ContentGenerator;
