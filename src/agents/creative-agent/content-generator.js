const axios = require('axios');
const { StabilityAI } = require('stability-ai');

class CreativeAgent {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.stabilityApiKey = process.env.STABILITY_API_KEY;
        this.stabilityClient = new StabilityAI(this.stabilityApiKey);
        
        this.contentTypes = {
            'blog_post': { maxTokens: 2000, temperature: 0.8 },
            'social_media': { maxTokens: 500, temperature: 0.9 },
            'ad_copy': { maxTokens: 300, temperature: 0.8 },
            'product_description': { maxTokens: 400, temperature: 0.7 },
            'email': { maxTokens: 600, temperature: 0.7 }
        };
    }

    async execute(task) {
        const { prompt, contentType = 'blog_post', options = {} } = task;
        
        try {
            let result = {};

            // Generate text content
            if (options.generateText !== false) {
                result.text = await this.generateTextContent(prompt, contentType, options);
            }

            // Generate image if requested
            if (options.generateImage) {
                result.image = await this.generateImage(prompt, options.imageStyle);
            }

            return {
                success: true,
                ...result,
                contentType: contentType,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Creative agent error:', error);
            return {
                success: false,
                error: error.message,
                content: null
            };
        }
    }

    async generateTextContent(prompt, contentType, options) {
        const config = this.contentTypes[contentType] || this.contentTypes.blog_post;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(contentType, options)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature,
                ...options
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    }

    getSystemPrompt(contentType, options) {
        const prompts = {
            'blog_post': "You are a professional blog writer. Create engaging, well-structured blog posts with compelling introductions and conclusions.",
            'social_media': "You are a social media expert. Create engaging, viral-style posts with appropriate hashtags and emojis.",
            'ad_copy': "You are a copywriting expert. Create persuasive, high-converting ad copy that drives action.",
            'product_description': "You are an e-commerce specialist. Create compelling product descriptions that highlight benefits and features.",
            'email': "You are an email marketing expert. Create engaging email content with clear calls-to-action."
        };

        let systemPrompt = prompts[contentType] || prompts.blog_post;

        if (options.tone) {
            systemPrompt += ` Use a ${options.tone} tone.`;
        }

        if (options.targetAudience) {
            systemPrompt += ` Target audience: ${options.targetAudience}.`;
        }

        return systemPrompt;
    }

    async generateImage(prompt, style = 'realistic') {
        try {
            const response = await this.stabilityClient.generate({
                prompt: prompt,
                height: 512,
                width: 512,
                steps: 30,
                cfg_scale: 7,
                sampler: 'K_DPMPP_2M',
                style_preset: style
            });

            // Convert base64 image data
            const imageData = response.artifacts[0].base64;
            return {
                base64: imageData,
                format: 'png',
                dimensions: { width: 512, height: 512 }
            };

        } catch (error) {
            console.error('Image generation failed:', error);
            
            // Fallback to DALL-E if Stability AI fails
            return await this.generateImageDalle(prompt);
        }
    }

    async generateImageDalle(prompt) {
        const response = await axios.post(
            'https://api.openai.com/v1/images/generations',
            {
                prompt: prompt,
                n: 1,
                size: "512x512",
                response_format: "b64_json"
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            base64: response.data.data[0].b64_json,
            format: 'png',
            dimensions: { width: 512, height: 512 }
        };
    }

    async generateMultipleVariations(prompt, contentType, count = 3) {
        const variations = [];
        
        for (let i = 0; i < count; i++) {
            const variation = await this.generateTextContent(
                prompt, 
                contentType, 
                { temperature: 0.9 + (i * 0.1) } // Increase temperature for more variation
            );
            variations.push(variation);
        }
        
        return variations;
    }

    async optimizeContent(content, optimizationGoal) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a content optimization expert. Optimize the following content for: ${optimizationGoal}`
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    }
}

module.exports = CreativeAgent;
