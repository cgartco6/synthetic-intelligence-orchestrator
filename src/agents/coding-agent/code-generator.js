const axios = require('axios');

class CodingAgent {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.languageConfigs = {
            'javascript': { maxTokens: 2000, temperature: 0.3 },
            'python': { maxTokens: 2000, temperature: 0.3 },
            'java': { maxTokens: 2500, temperature: 0.2 },
            'cpp': { maxTokens: 2500, temperature: 0.2 },
            'html': { maxTokens: 1000, temperature: 0.1 },
            'css': { maxTokens: 1000, temperature: 0.1 },
            'sql': { maxTokens: 1500, temperature: 0.2 }
        };
    }

    async execute(task) {
        const { prompt, language = 'javascript', options = {} } = task;
        
        try {
            const code = await this.generateCode(prompt, language, options);
            const explanation = options.includeExplanation ? 
                await this.generateExplanation(code, language) : null;

            const tests = options.includeTests ?
                await this.generateTests(code, language) : null;

            return {
                success: true,
                code: code,
                language: language,
                explanation: explanation,
                tests: tests,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Coding agent error:', error);
            return {
                success: false,
                error: error.message,
                code: null
            };
        }
    }

    async generateCode(prompt, language, options) {
        const config = this.languageConfigs[language] || this.languageConfigs.javascript;
        
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(language, options)
                    },
                    {
                        role: "user",
                        content: prompt
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

        return this.extractCodeFromResponse(response.data.choices[0].message.content, language);
    }

    getSystemPrompt(language, options) {
        let prompt = `You are an expert ${language} developer. Generate clean, efficient, and well-documented code.`;

        if (options.framework) {
            prompt += ` Use the ${options.framework} framework.`;
        }

        if (options.bestPractices !== false) {
            prompt += " Follow industry best practices and include appropriate error handling.";
        }

        if (options.comments !== false) {
            prompt += " Include helpful comments to explain complex logic.";
        }

        return prompt;
    }

    extractCodeFromResponse(response, language) {
        // Extract code from markdown code blocks
        const codeBlockRegex = new RegExp(`\`\`\`${language}(.*?)\`\`\``, 's');
        const match = response.match(codeBlockRegex);
        
        if (match) {
            return match[1].trim();
        }

        // If no code block found, return the entire response
        return response.trim();
    }

    async generateExplanation(code, language) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a technical educator. Explain the following ${language} code in simple terms.`
                    },
                    {
                        role: "user",
                        content: code
                    }
                ],
                max_tokens: 500,
                temperature: 0.5
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

    async generateTests(code, language) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a QA engineer. Generate comprehensive unit tests for the following ${language} code.`
                    },
                    {
                        role: "user",
                        content: code
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return this.extractCodeFromResponse(response.data.choices[0].message.content, language);
    }

    async debugCode(code, language, error) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a debugging expert. Help fix the following ${language} code.`
                    },
                    {
                        role: "user",
                        content: `Code:\n${code}\n\nError: ${error}`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            fixedCode: this.extractCodeFromResponse(response.data.choices[0].message.content, language),
            explanation: response.data.choices[0].message.content
        };
    }

    async refactorCode(code, language, goal) {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a code refactoring expert. Refactor the following ${language} code to ${goal}.`
                    },
                    {
                        role: "user",
                        content: code
                    }
                ],
                max_tokens: 1500,
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            refactoredCode: this.extractCodeFromResponse(response.data.choices[0].message.content, language),
            explanation: response.data.choices[0].message.content
        };
    }
}

module.exports = CodingAgent;
