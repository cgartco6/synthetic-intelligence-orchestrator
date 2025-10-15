const axios = require('axios');

class AnalysisAgent {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.analysisTypes = {
            'sentiment': { maxTokens: 500, temperature: 0.3 },
            'summary': { maxTokens: 800, temperature: 0.4 },
            'trends': { maxTokens: 1000, temperature: 0.5 },
            'insights': { maxTokens: 1200, temperature: 0.6 },
            'comparison': { maxTokens: 1000, temperature: 0.4 }
        };
    }

    async execute(task) {
        const { data, analysisType = 'insights', options = {} } = task;
        
        try {
            let result;

            switch (analysisType) {
                case 'sentiment':
                    result = await this.analyzeSentiment(data, options);
                    break;
                case 'summary':
                    result = await this.generateSummary(data, options);
                    break;
                case 'trends':
                    result = await this.identifyTrends(data, options);
                    break;
                case 'comparison':
                    result = await this.compareData(data, options);
                    break;
                default:
                    result = await this.generateInsights(data, options);
            }

            return {
                success: true,
                analysisType: analysisType,
                ...result,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Analysis agent error:', error);
            return {
                success: false,
                error: error.message,
                insights: null
            };
        }
    }

    async analyzeSentiment(data, options) {
        const config = this.analysisTypes.sentiment;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a sentiment analysis expert. Analyze the sentiment of the provided text and provide a detailed analysis including overall sentiment, confidence level, and key factors influencing the sentiment."
                    },
                    {
                        role: "user",
                        content: this.formatDataForAnalysis(data)
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            sentiment: response.data.choices[0].message.content,
            metrics: this.extractSentimentMetrics(response.data.choices[0].message.content)
        };
    }

    async generateSummary(data, options) {
        const config = this.analysisTypes.summary;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a summarization expert. Create a comprehensive summary that captures the key points, main ideas, and important details from the provided content."
                    },
                    {
                        role: "user",
                        content: this.formatDataForAnalysis(data)
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            summary: response.data.choices[0].message.content,
            keyPoints: await this.extractKeyPoints(response.data.choices[0].message.content)
        };
    }

    async identifyTrends(data, options) {
        const config = this.analysisTypes.trends;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a data trends analyst. Identify and analyze trends, patterns, and anomalies in the provided data. Provide insights about what the trends might indicate and their potential implications."
                    },
                    {
                        role: "user",
                        content: this.formatDataForAnalysis(data)
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            trends: response.data.choices[0].message.content,
            patterns: this.extractPatterns(response.data.choices[0].message.content)
        };
    }

    async generateInsights(data, options) {
        const config = this.analysisTypes.insights;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a data insights expert. Analyze the provided data and generate actionable insights, recommendations, and observations. Focus on providing valuable, practical information that can inform decision-making."
                    },
                    {
                        role: "user",
                        content: this.formatDataForAnalysis(data)
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            insights: response.data.choices[0].message.content,
            recommendations: await this.extractRecommendations(response.data.choices[0].message.content)
        };
    }

    async compareData(data, options) {
        const config = this.analysisTypes.comparison;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a comparative analysis expert. Compare the provided datasets and highlight similarities, differences, strengths, weaknesses, and relative performance."
                    },
                    {
                        role: "user",
                        content: this.formatDataForAnalysis(data)
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            comparison: response.data.choices[0].message.content,
            keyDifferences: this.extractDifferences(response.data.choices[0].message.content)
        };
    }

    formatDataForAnalysis(data) {
        if (typeof data === 'string') {
            return data;
        } else if (Array.isArray(data)) {
            return data.map(item => 
                typeof item === 'string' ? item : JSON.stringify(item)
            ).join('\n\n');
        } else if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        
        return String(data);
    }

    extractSentimentMetrics(analysis) {
        // Simple extraction of sentiment metrics from analysis text
        const metrics = {
            overall: 'neutral',
            confidence: 0.5,
            positiveFactors: [],
            negativeFactors: []
        };

        if (analysis.toLowerCase().includes('positive')) metrics.overall = 'positive';
        if (analysis.toLowerCase().includes('negative')) metrics.overall = 'negative';

        // Extract confidence if mentioned
        const confidenceMatch = analysis.match(/(\d+)% confidence/);
        if (confidenceMatch) {
            metrics.confidence = parseInt(confidenceMatch[1]) / 100;
        }

        return metrics;
    }

    async extractKeyPoints(summary) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Extract the key points as a bulleted list from the following summary:"
                    },
                    {
                        role: "user",
                        content: summary
                    }
                ],
                max_tokens: 300,
                temperature: 0.3
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

    extractPatterns(trendsAnalysis) {
        // Extract patterns from trends analysis
        const patterns = [];
        const lines = trendsAnalysis.split('\n');
        
        lines.forEach(line => {
            if (line.includes('pattern') || line.includes('trend') || line.includes('increase') || line.includes('decrease')) {
                patterns.push(line.trim());
            }
        });
        
        return patterns.slice(0, 5); // Return top 5 patterns
    }

    async extractRecommendations(insights) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Extract actionable recommendations as a bulleted list from the following insights:"
                    },
                    {
                        role: "user",
                        content: insights
                    }
                ],
                max_tokens: 400,
                temperature: 0.3
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

    extractDifferences(comparison) {
        // Extract key differences from comparison analysis
        const differences = [];
        const lines = comparison.split('\n');
        
        lines.forEach(line => {
            if (line.includes('difference') || line.includes('versus') || line.includes('compared to')) {
                differences.push(line.trim());
            }
        });
        
        return differences.slice(0, 10); // Return top 10 differences
    }
}

module.exports = AnalysisAgent;
