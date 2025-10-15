const express = require('express');
const router = express.Router();
const SyntheticIntelligenceOrchestrator = require('../agents/orchestrator/orchestrator');
const adMiddleware = require('../middleware/ad-middleware');
const rateLimit = require('../middleware/rate-limiter');

const orchestrator = new SyntheticIntelligenceOrchestrator();

// Apply agent-specific rate limiting
router.use(rateLimit.agentLimiter);

// Apply ad middleware
router.use(adMiddleware.adMiddleware);

router.post('/process', async (req, res) => {
    try {
        const { task, options = {} } = req.body;
        const user = req.user;

        if (!task || !task.type || !task.prompt) {
            return res.status(400).json({
                success: false,
                error: 'Task must include type and prompt'
            });
        }

        // Process the task
        const result = await orchestrator.processTask(task, user);

        // Include ad information if required
        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Task processing error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/research', async (req, res) => {
    try {
        const { prompt, includeWebSearch = true, options = {} } = req.body;
        const user = req.user;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Research prompt is required'
            });
        }

        const task = {
            type: 'research',
            agentType: 'research',
            prompt: prompt,
            options: {
                includeWebSearch,
                ...options
            }
        };

        const result = await orchestrator.processTask(task, user);

        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Research task error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/generate-content', async (req, res) => {
    try {
        const { 
            prompt, 
            contentType = 'blog_post', 
            generateImage = false,
            options = {} 
        } = req.body;
        const user = req.user;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Content prompt is required'
            });
        }

        const task = {
            type: 'content_creation',
            agentType: 'creative',
            prompt: prompt,
            contentType: contentType,
            options: {
                generateImage,
                ...options
            }
        };

        const result = await orchestrator.processTask(task, user);

        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Content generation error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/generate-code', async (req, res) => {
    try {
        const { 
            prompt, 
            language = 'javascript', 
            includeTests = false,
            includeExplanation = true,
            options = {} 
        } = req.body;
        const user = req.user;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: 'Code generation prompt is required'
            });
        }

        const task = {
            type: 'code_generation',
            agentType: 'coding',
            prompt: prompt,
            language: language,
            options: {
                includeTests,
                includeExplanation,
                ...options
            }
        };

        const result = await orchestrator.processTask(task, user);

        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Code generation error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/analyze-data', async (req, res) => {
    try {
        const { 
            data, 
            analysisType = 'insights',
            options = {} 
        } = req.body;
        const user = req.user;

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Data to analyze is required'
            });
        }

        const task = {
            type: 'data_analysis',
            agentType: 'analysis',
            data: data,
            analysisType: analysisType,
            options: options
        };

        const result = await orchestrator.processTask(task, user);

        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Data analysis error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/text-to-speech', async (req, res) => {
    try {
        const { 
            text, 
            voiceType = 'neutral',
            options = {} 
        } = req.body;
        const user = req.user;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'Text to convert is required'
            });
        }

        const task = {
            type: 'voice_processing',
            agentType: 'voice',
            text: text,
            voiceType: voiceType,
            options: options
        };

        const result = await orchestrator.processTask(task, user);

        const response = {
            success: true,
            ...result
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Text-to-speech error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/speech-to-text', async (req, res) => {
    try {
        const { audioData } = req.body;
        const user = req.user;

        if (!audioData) {
            return res.status(400).json({
                success: false,
                error: 'Audio data is required'
            });
        }

        // This would typically handle file uploads
        // For now, we'll assume base64 audio data
        const VoiceAgent = require('../agents/voice-agent/text-to-speech');
        const voiceAgent = new VoiceAgent();

        const result = await voiceAgent.speechToText(audioData);

        const response = {
            success: result.success,
            text: result.text,
            language: result.language,
            duration: result.duration
        };

        if (req.adServed) {
            response.adRequired = true;
            response.adData = req.requiredAd;
        }

        res.json(response);

    } catch (error) {
        console.error('Speech-to-text error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const user = req.user;

        const task = await orchestrator.getTaskStatus(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        // Check if user owns this task
        if (task.user_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this task'
            });
        }

        res.json({
            success: true,
            task: task
        });

    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get task'
        });
    }
});

router.get('/tasks', async (req, res) => {
    try {
        const user = req.user;
        const { limit = 10, offset = 0 } = req.query;

        const tasks = await orchestrator.getUserTasks(user.id, parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            tasks: tasks,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: tasks.length
            }
        });

    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tasks'
        });
    }
});

router.get('/queue-stats', async (req, res) => {
    try {
        const stats = orchestrator.getQueueStats();

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Get queue stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get queue stats'
        });
    }
});

router.get('/usage', async (req, res) => {
    try {
        const user = req.user;
        const userStats = await userModel.getUserStats(user.id);

        const taskLimits = {
            'free': { text: 5, image: 1, code: 1, research: 1, analysis: 1, voice: 0 },
            'basic': { text: 50, image: 10, code: 10, research: 10, analysis: 10, voice: 5 },
            'premium': { text: 200, image: 50, code: 50, research: 50, analysis: 50, voice: 20 },
            'enterprise': { text: -1, image: -1, code: -1, research: -1, analysis: -1, voice: -1 }
        };

        const limits = taskLimits[user.subscriptionTier] || taskLimits.free;

        res.json({
            success: true,
            usage: {
                tasksToday: userStats.tasks_today || 0,
                adsToday: userStats.ads_today || 0,
                totalAds: userStats.total_ads || 0,
                limits: limits,
                subscriptionTier: user.subscriptionTier
            }
        });

    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get usage stats'
        });
    }
});

// Debug endpoint for development
if (process.env.NODE_ENV === 'development') {
    router.get('/debug/agents', (req, res) => {
        const agents = Array.from(orchestrator.agents.keys());
        res.json({
            success: true,
            agents: agents,
            queueStats: orchestrator.getQueueStats()
        });
    });
}

module.exports = router;
