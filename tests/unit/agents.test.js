const request = require('supertest');
const app = require('../../src/app');
const SyntheticIntelligenceOrchestrator = require('../../src/agents/orchestrator/orchestrator');

describe('AI Agents System', () => {
    let orchestrator;
    let authToken;
    let testUser;

    beforeAll(async () => {
        // Create test user and get auth token
        testUser = {
            email: 'agenttest@example.com',
            password: 'TestPassword123!',
            firstName: 'Agent',
            lastName: 'Test'
        };

        // Register and login test user
        await request(app)
            .post('/api/auth/register')
            .send(testUser);

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        authToken = loginResponse.body.token;
        orchestrator = new SyntheticIntelligenceOrchestrator();
    });

    afterAll(async () => {
        // Clean up test data
        const UserModel = require('../../src/models/user');
        const userModel = new UserModel();
        const user = await userModel.getUserByEmail(testUser.email);
        if (user) {
            await userModel.deleteUser(user.id);
        }
    });

    describe('Task Processing', () => {
        it('should process text generation task', async () => {
            const task = {
                task: {
                    type: 'text',
                    agentType: 'creative',
                    prompt: 'Write a short paragraph about artificial intelligence.',
                    options: {
                        contentType: 'blog_post'
                    }
                }
            };

            const response = await request(app)
                .post('/api/agents/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send(task)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.taskId).toBeDefined();
            expect(['queued', 'processing']).toContain(response.body.status);
        });

        it('should process code generation task', async () => {
            const task = {
                task: {
                    type: 'code',
                    agentType: 'coding',
                    prompt: 'Create a function to calculate factorial in JavaScript',
                    language: 'javascript',
                    options: {
                        includeExplanation: true
                    }
                }
            };

            const response = await request(app)
                .post('/api/agents/generate-code')
                .set('Authorization', `Bearer ${authToken}`)
                .send(task)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should enforce task limits for free tier', async () => {
            // Free tier has limited tasks - try to exceed limit
            const tasks = [];
            for (let i = 0; i < 10; i++) {
                tasks.push(
                    request(app)
                        .post('/api/agents/process')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            task: {
                                type: 'text',
                                agentType: 'creative',
                                prompt: `Test task ${i}`
                            }
                        })
                );
            }

            const responses = await Promise.all(tasks);
            // Some should fail due to limits
            const failed = responses.filter(r => !r.body.success);
            expect(failed.length).toBeGreaterThan(0);
        });

        it('should validate task structure', async () => {
            const invalidTask = {
                task: {
                    // Missing required fields
                }
            };

            const response = await request(app)
                .post('/api/agents/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidTask)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('must include');
        });
    });

    describe('Agent Orchestration', () => {
        it('should initialize all agents', () => {
            const agents = Array.from(orchestrator.agents.keys());
            expect(agents).toContain('research');
            expect(agents).toContain('creative');
            expect(agents).toContain('coding');
            expect(agents).toContain('analysis');
            expect(agents).toContain('voice');
        });

        it('should validate agent access by tier', async () => {
            // Free tier should not have access to voice agent
            const task = {
                task: {
                    type: 'voice',
                    agentType: 'voice',
                    text: 'Hello world',
                    voiceType: 'neutral'
                }
            };

            const response = await request(app)
                .post('/api/agents/text-to-speech')
                .set('Authorization', `Bearer ${authToken}`)
                .send(task)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not available');
        });

        it('should track task usage', async () => {
            const initialStats = await orchestrator.getUserTasks(testUser.id, 1);
            
            const task = {
                task: {
                    type: 'text',
                    agentType: 'creative',
                    prompt: 'Test task for usage tracking'
                }
            };

            await request(app)
                .post('/api/agents/process')
                .set('Authorization', `Bearer ${authToken}`)
                .send(task);

            const updatedStats = await orchestrator.getUserTasks(testUser.id, 1);
            expect(updatedStats.length).toBeGreaterThan(initialStats.length);
        });
    });

    describe('Task Queue Management', () => {
        it('should manage task queue efficiently', async () => {
            const stats = orchestrator.getQueueStats();
            expect(stats).toHaveProperty('queueLength');
            expect(stats).toHaveProperty('processing');
            expect(stats).toHaveProperty('waiting');
            expect(stats).toHaveProperty('estimatedWait');
        });

        it('should process tasks in order', async () => {
            const task1 = orchestrator.processTask(
                { type: 'text', agentType: 'creative', prompt: 'First task' },
                { id: testUser.id, subscriptionTier: 'free' }
            );

            const task2 = orchestrator.processTask(
                { type: 'text', agentType: 'creative', prompt: 'Second task' },
                { id: testUser.id, subscriptionTier: 'free' }
            );

            const [result1, result2] = await Promise.all([task1, task2]);
            expect(result1.position).toBeLessThan(result2.position);
        });
    });
});
