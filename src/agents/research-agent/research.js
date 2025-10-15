const axios = require('axios');

class ResearchAgent {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.serpApiKey = process.env.SERP_API_KEY;
        this.baseConfig = {
            maxTokens: 4000,
            temperature: 0.7,
            model: "gpt-4"
        };
    }

    async execute(task) {
        const { prompt, options = {} } = task;
        
        try {
            // Perform web search if needed
            let searchResults = [];
            if (options.includeWebSearch) {
                searchResults = await this.performWebSearch(prompt);
            }

            // Generate research content
            const researchContent = await this.generateResearchContent(prompt, searchResults, options);

            return {
                success: true,
                content: researchContent,
                sources: searchResults,
                wordCount: researchContent.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Research agent error:', error);
            return {
                success: false,
                error: error.message,
                content: null
            };
        }
    }

    async performWebSearch(query) {
        try {
            const response = await axios.get('https://serpapi.com/search', {
                params: {
                    q: query,
                    api_key: this.serpApiKey,
                    engine: 'google',
                    num: 5
                }
            });

            return response.data.organic_results?.map(result => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet
            })) || [];

        } catch (error) {
            console.error('Web search failed:', error);
            return [];
        }
    }

    async generateResearchContent(prompt, searchResults, options) {
        const context = this.buildResearchContext(prompt, searchResults);
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: this.baseConfig.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a research assistant. Provide comprehensive, well-structured research based on the given prompt and available sources. Include citations where appropriate."
                    },
                    {
                        role: "user",
                        content: context
                    }
                ],
                max_tokens: this.baseConfig.maxTokens,
                temperature: this.baseConfig.temperature
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

    buildResearchContext(prompt, searchResults) {
        let context = `Research Topic: ${prompt}\n\n`;

        if (searchResults.length > 0) {
            context += "Available Sources:\n";
            searchResults.forEach((result, index) => {
                context += `${index + 1}. ${result.title}\n`;
                context += `   URL: ${result.link}\n`;
                context += `   Summary: ${result.snippet}\n\n`;
            });
        }

        context += "Please provide a comprehensive research report on this topic. Include key findings, analysis, and cite sources where appropriate.";

        return context;
    }

    async summarizeContent(content, maxLength = 500) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are a summarization expert. Create concise summaries while preserving key information."
                    },
                    {
                        role: "user",
                        content: `Please summarize the following content in under ${maxLength} words:\n\n${content}`
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

    async extractKeyPoints(content) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "Extract the key points from the provided content. Return as a bulleted list."
                    },
                    {
                        role: "user",
                        content: content
                    }
                ],
                max_tokens: 500,
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
}

module.exports = ResearchAgent;
