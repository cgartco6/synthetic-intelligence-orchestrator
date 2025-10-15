const axios = require('axios');
const fs = require('fs');
const path = require('path');

class VoiceAgent {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
        this.voices = {
            'male': 'VR6AewLTigWG4xSOukaG',
            'female': 'EXAVITQu4vr4xnSDxMaL',
            'neutral': 'JBFqnCBsd6RMkjVDRZzb'
        };
    }

    async execute(task) {
        const { text, voiceType = 'neutral', options = {} } = task;
        
        try {
            let audioData;

            // Use ElevenLabs for high-quality voice generation
            if (this.elevenLabsApiKey) {
                audioData = await this.generateWithElevenLabs(text, voiceType, options);
            } else {
                // Fallback to OpenAI TTS
                audioData = await this.generateWithOpenAI(text, options);
            }

            return {
                success: true,
                audio: audioData,
                voiceType: voiceType,
                duration: this.estimateDuration(text),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Voice agent error:', error);
            return {
                success: false,
                error: error.message,
                audio: null
            };
        }
    }

    async generateWithElevenLabs(text, voiceType, options) {
        const voiceId = this.voices[voiceType] || this.voices.neutral;
        
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: options.stability || 0.5,
                    similarity_boost: options.similarity || 0.5
                }
            },
            {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return {
            base64: Buffer.from(response.data).toString('base64'),
            format: 'mp3',
            provider: 'elevenlabs'
        };
    }

    async generateWithOpenAI(text, options) {
        const response = await axios.post(
            'https://api.openai.com/v1/audio/speech',
            {
                model: "tts-1",
                input: text,
                voice: options.voice || "alloy",
                response_format: "mp3"
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return {
            base64: Buffer.from(response.data).toString('base64'),
            format: 'mp3',
            provider: 'openai'
        };
    }

    estimateDuration(text) {
        // Rough estimate: 150 words per minute
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / 150 * 60); // Duration in seconds
    }

    async speechToText(audioData) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/audio/transcriptions',
                {
                    file: audioData,
                    model: "whisper-1",
                    response_format: "json"
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            return {
                success: true,
                text: response.data.text,
                language: response.data.language,
                duration: response.data.duration
            };

        } catch (error) {
            console.error('Speech to text error:', error);
            return {
                success: false,
                error: error.message,
                text: null
            };
        }
    }

    async generateMultipleVoices(text, voiceTypes = ['male', 'female']) {
        const results = {};
        
        for (const voiceType of voiceTypes) {
            try {
                results[voiceType] = await this.generateWithElevenLabs(text, voiceType, {});
            } catch (error) {
                console.error(`Failed to generate ${voiceType} voice:`, error);
                results[voiceType] = null;
            }
        }
        
        return results;
    }

    async saveAudioToFile(audioData, filename) {
        const audioBuffer = Buffer.from(audioData.base64, 'base64');
        const filePath = path.join(__dirname, '../../public/audio', filename);
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, audioBuffer);
        return `/audio/${filename}`;
    }

    getAvailableVoices() {
        return Object.keys(this.voices).map(voiceType => ({
            type: voiceType,
            id: this.voices[voiceType],
            description: this.getVoiceDescription(voiceType)
        }));
    }

    getVoiceDescription(voiceType) {
        const descriptions = {
            'male': 'Deep, masculine voice suitable for professional content',
            'female': 'Clear, feminine voice ideal for narration and explanations',
            'neutral': 'Balanced voice suitable for most content types'
        };
        
        return descriptions[voiceType] || 'General purpose voice';
    }
}

module.exports = VoiceAgent;
