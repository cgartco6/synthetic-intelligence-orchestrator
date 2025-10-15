const axios = require('axios');
const SecurityManager = require('../../../security/encryption');

class SyntheticIntelligenceOrchestrator {
    constructor() {
        this.agents = new Map();
        this.taskQueue = [];
        this.securityManager = new SecurityManager();
        this.taskLimits = {
            'free': {
                text: 5, image: 1, code: 1, research: 1, analysis: 1, voice: 0
            },
            'basic': {
                text: 50, image: 10, code: 10, research: 10, analysis: 10, voice: 5
            },
            'premium': {
                text: 200, image: 50, code: 50, research: 50, analysis: 50, voice: 20
            },
            'enterprise': {
                text: -1, image: -1, code: -1, research: -1, analysis: -1, voice: -1
            }
        };
        
        this.initAgents();
        this.startTaskProcessor();
    }

    initAgents() {
        const ResearchAgent = require('../research-agent/research');
        const CreativeAgent = require('../creative-agent/content-generator');
        const CodingAgent = require('../coding-agent/code-generator');
        const AnalysisAgent = require('../analysis-agent/data-analyzer');
        const VoiceAgent = require('../voice-agent/text-to-speech');

        this.agents.set('research', new ResearchAgent());
        this.agents.set('creative', new CreativeAgent());
        this.agents.set('coding', new CodingAgent());
        this.agents.set('analysis', new AnalysisAgent());
        this.agents.set('voice', new VoiceAgent());
    }

    async processTask(task, user) {
        const userTier = user.subscriptionTier || 'free';
        
        // Validate task
        const validation = await this.validateTask(task, user, userTier);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check daily task limit
        if (!await this.canProcessTask(user.id, userTier, task.type)) {
            throw new Error(`Daily ${task.type} task limit reached for ${userTier} tier.`);
        }

        // Encrypt sensitive task data
        const encryptedTask = this.encryptTaskData(task);

        // Queue the task
        const queuedTask = {
            id: this.generateTaskId(),
            userId: user.id,
            userTier: userTier,
            task: encryptedTask,
            type: task.type,
            status: 'queued',
            createdAt: new Date()
        };

        this.taskQueue.push(queuedTask);
        
        // Record task usage
        await this.recordTaskUsage(user.id, userTier, task.type);

        return {
            taskId: queuedTask.id,
            status: 'queued',
            position: this.taskQueue.length,
            estimatedWait: this.estimateWaitTime()
        };
    }

    async validateTask(task, user, userTier) {
        // Check if agent type is available for user tier
        if (!this.validateAgentAccess(userTier, task.agentType)) {
            return {
                valid: false,
                error: `Agent ${task.agentType} not available for your subscription tier`
            };
        }

        // Validate task structure
        if (!task.type || !task.prompt) {
            return {
                valid: false,
                error: 'Task must include type and prompt'
            };
        }

        // Check for inappropriate content
        if (this.containsInappropriateContent(task.prompt)) {
            return {
                valid: false,
                error: 'Task contains inappropriate content'
            };
        }

        return { valid: true };
    }

    validateAgentAccess(userTier, agentType) {
        const tierAccess = {
            'free': ['research', 'creative', 'coding', 'analysis'],
            'basic': ['research', 'creative', 'coding', 'analysis', 'voice'],
            'premium': ['research', 'creative', 'coding', 'analysis', 'voice'],
            'enterprise': ['research', 'creative', 'coding', 'analysis', 'voice', 'custom']
        };

        return tierAccess[userTier]?.includes(agentType) || false;
    }

    async canProcessTask(userId, userTier, taskType) {
        const limits = this.taskLimits[userTier];
        if (limits[taskType] === -1) return true; // unlimited
        
        const todayTasks = await this.getTodayTaskCount(userId, taskType);
        return todayTasks < limits[taskType];
    }

    async getTodayTaskCount(userId, taskType) {
        const db = require('../../services/database/mysql-connector');
        
        try {
            const [rows] = await db.execute(
                `SELECT COUNT(*) as count FROM tasks 
                 WHERE user_id = ? AND task_type = ? 
                 AND DATE(created_at) = CURDATE()`,
                [userId, taskType]
            );
            
            return rows[0].count;
        } catch (error) {
            console.error('Error getting task count:', error);
            return 0;
        }
    }

    encryptTaskData(task) {
        return {
            ...task,
            prompt: this.securityManager.encrypt(task.prompt),
            sensitiveData: task.sensitiveData ? this.securityManager.encrypt(JSON.stringify(task.sensitiveData)) : null
        };
    }

    decryptTaskResult(encryptedResult) {
        return {
            ...encryptedResult,
            content: this.securityManager.decrypt(encryptedResult.content),
            metadata: encryptedResult.metadata ? JSON.parse(this.securityManager.decrypt(encryptedResult.metadata)) : null
        };
    }

    containsInappropriateContent(text) {
        const inappropriatePatterns = [
            /violence/i,
            /hate speech/i,
            /illegal activities/i,
            /adult content/i
        ];

        return inappropriatePatterns.some(pattern => pattern.test(text));
    }

    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    estimateWaitTime() {
        const avgProcessingTime = 5000; // 5 seconds average
        return this.taskQueue.length * avgProcessingTime;
    }

    async recordTaskUsage(userId, userTier, taskType) {
        const db = require('../../services/database/mysql-connector');
        
        try {
            await db.execute(
                `INSERT INTO task_usage (user_id, tier, task_type, created_at) 
                 VALUES (?, ?, ?, NOW())`,
                [userId, userTier, taskType]
            );
        } catch (error) {
            console.error('Error recording task usage:', error);
        }
    }

    startTaskProcessor() {
        setInterval(async () => {
            if (this.taskQueue.length > 0) {
                const task = this.taskQueue.shift();
                await this.processQueuedTask(task);
            }
        }, 1000); // Process one task per second
    }

    async processQueuedTask(queuedTask) {
        try {
            queuedTask.status = 'processing';
            
            const agent = this.agents.get(queuedTask.task.agentType);
            if (!agent) {
                throw new Error(`Unknown agent type: ${queuedTask.task.agentType}`);
            }

            const result = await agent.execute(queuedTask.task);
            
            // Store result
            await this.storeTaskResult(queuedTask, result);
            
            // Update task status
            queuedTask.status = 'completed';
            queuedTask.completedAt = new Date();
            
        } catch (error) {
            console.error(`Task ${queuedTask.id} failed:`, error);
            queuedTask.status = 'failed';
            queuedTask.error = error.message;
            
            await this.storeTaskResult(queuedTask, { error: error.message });
        }
    }

    async storeTaskResult(task, result) {
        const db = require('../../services/database/mysql-connector');
        
        try {
            await db.execute(
                `INSERT INTO tasks 
                 (id, user_id, task_type, task_data, result_data, status, created_at, completed_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    task.id,
                    task.userId,
                    task.type,
                    JSON.stringify(task.task),
                    JSON.stringify(result),
                    task.status,
                    task.createdAt,
                    task.completedAt
                ]
            );
        } catch (error) {
            console.error('Error storing task result:', error);
        }
    }

    async getTaskStatus(taskId) {
        const db = require('../../services/database/mysql-connector');
        
        try {
            const [rows] = await db.execute(
                'SELECT * FROM tasks WHERE id = ?',
                [taskId]
            );
            
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting task status:', error);
            return null;
        }
    }

    async getUserTasks(userId, limit = 10) {
        const db = require('../../services/database/mysql-connector');
        
        try {
            const [rows] = await db.execute(
                'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
                [userId, limit]
            );
            
            return rows;
        } catch (error) {
            console.error('Error getting user tasks:', error);
            return [];
        }
    }

    getQueueStats() {
        return {
            queueLength: this.taskQueue.length,
            processing: this.taskQueue.filter(t => t.status === 'processing').length,
            waiting: this.taskQueue.filter(t => t.status === 'queued').length,
            estimatedWait: this.estimateWaitTime()
        };
    }
}

module.exports = SyntheticIntelligenceOrchestrator;
