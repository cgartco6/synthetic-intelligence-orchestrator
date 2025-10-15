module.exports = {
    // OpenAI Configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        models: {
            chat: 'gpt-4',
            chatFallback: 'gpt-3.5-turbo',
            image: 'dall-e-3',
            imageFallback: 'dall-e-2',
            whisper: 'whisper-1'
        },
        limits: {
            maxTokens: 4000,
            requestTimeout: 30000,
            retryAttempts: 3
        }
    },

    // Anthropic Claude Configuration
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-2',
        maxTokens: 4000,
        temperature: 0.7
    },

    // Google AI Configuration
    googleAI: {
        apiKey: process.env.GOOGLE_AI_KEY,
        models: {
            text: 'gemini-pro',
            vision: 'gemini-pro-vision'
        }
    },

    // Stability AI Configuration
    stabilityAI: {
        apiKey: process.env.STABILITY_API_KEY,
        engine: 'stable-diffusion-xl-1024-v1-0',
        defaults: {
            height: 512,
            width: 512,
            steps: 30,
            cfg_scale: 7
        }
    },

    // ElevenLabs Configuration (Voice)
    elevenLabs: {
        apiKey: process.env.ELEVEN_LABS_API_KEY,
        voices: {
            male: 'VR6AewLTigWG4xSOukaG',
            female: 'EXAVITQu4vr4xnSDxMaL',
            neutral: 'JBFqnCBsd6RMkjVDRZzb'
        }
    },

    // SerpAPI Configuration (Web Search)
    serpAPI: {
        apiKey: process.env.SERP_API_KEY,
        engine: 'google',
        numResults: 5
    },

    // Agent-specific configurations
    agents: {
        research: {
            maxTokens: 4000,
            temperature: 0.7,
            includeWebSearch: true
        },
        creative: {
            maxTokens: 2000,
            temperature: 0.8,
            contentTypes: {
                blog_post: { maxTokens: 2000, temperature: 0.8 },
                social_media: { maxTokens: 500, temperature: 0.9 },
                ad_copy: { maxTokens: 300, temperature: 0.8 },
                product_description: { maxTokens: 400, temperature: 0.7 },
                email: { maxTokens: 600, temperature: 0.7 }
            }
        },
        coding: {
            maxTokens: 2000,
            temperature: 0.3,
            languages: {
                javascript: { maxTokens: 2000, temperature: 0.3 },
                python: { maxTokens: 2000, temperature: 0.3 },
                java: { maxTokens: 2500, temperature: 0.2 },
                cpp: { maxTokens: 2500, temperature: 0.2 },
                html: { maxTokens: 1000, temperature: 0.1 },
                css: { maxTokens: 1000, temperature: 0.1 },
                sql: { maxTokens: 1500, temperature: 0.2 }
            }
        },
        analysis: {
            maxTokens: 1200,
            temperature: 0.6,
            analysisTypes: {
                sentiment: { maxTokens: 500, temperature: 0.3 },
                summary: { maxTokens: 800, temperature: 0.4 },
                trends: { maxTokens: 1000, temperature: 0.5 },
                insights: { maxTokens: 1200, temperature: 0.6 },
                comparison: { maxTokens: 1000, temperature: 0.4 }
            }
        },
        voice: {
            defaultVoice: 'neutral',
            formats: {
                mp3: { quality: 'standard' },
                wav: { quality: 'high' }
            }
        }
    },

    // Rate limiting for AI APIs
    rateLimiting: {
        openai: {
            requestsPerMinute: 60,
            tokensPerMinute: 150000
        },
        anthropic: {
            requestsPerMinute: 30,
            tokensPerMinute: 100000
        },
        stabilityAI: {
            requestsPerMinute: 10,
            imagesPerMinute: 5
        }
    },

    // Fallback strategies
    fallbacks: {
        primary: 'openai',
        secondary: 'anthropic',
        tertiary: 'googleAI'
    },

    // Cost optimization
    costOptimization: {
        useCheaperModelsFor: ['summarization', 'simple_classification'],
        maxCostPerTask: 0.10, // USD
        dailySpendingLimit: 50.00 // USD
    }
};
