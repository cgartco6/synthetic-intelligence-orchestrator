const request = require('supertest');
const app = require('../../src/app');
const UserModel = require('../../src/models/user');
const SecurityManager = require('../../security/encryption');

describe('Authentication System', () => {
    let testUser;
    let authToken;

    beforeAll(async () => {
        // Create test user
        testUser = {
            email: 'test@example.com',
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
            country: 'US'
        };
    });

    afterAll(async () => {
        // Clean up test data
        const userModel = new UserModel();
        const user = await userModel.getUserByEmail(testUser.email);
        if (user) {
            await userModel.deleteUser(user.id);
        }
    });

    describe('User Registration', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(testUser.email);
            expect(response.body.user.firstName).toBe(testUser.firstName);
            expect(response.body.token).toBeDefined();
        });

        it('should reject duplicate email registration', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('already exists');
        });

        it('should validate password strength', async () => {
            const weakUser = {
                ...testUser,
                email: 'weak@example.com',
                password: 'weak'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(weakUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Password must be');
        });
    });

    describe('User Login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(testUser.email);
            expect(response.body.token).toBeDefined();

            authToken = response.body.token;
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'WrongPassword123!'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid credentials');
        });
    });

    describe('Profile Management', () => {
        it('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(testUser.email);
        });

        it('should reject profile access without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Access token required');
        });

        it('should update user profile', async () => {
            const updates = {
                firstName: 'Updated',
                lastName: 'Name',
                country: 'GB'
            };

            const response = await request(app)
                .put('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updates)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('Password Management', () => {
        it('should change password with valid current password', async () => {
            const passwordChange = {
                currentPassword: testUser.password,
                newPassword: 'NewPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordChange)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Update test user password for subsequent tests
            testUser.password = 'NewPassword123!';
        });

        it('should reject password change with invalid current password', async () => {
            const passwordChange = {
                currentPassword: 'WrongPassword123!',
                newPassword: 'NewPassword123!'
            };

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send(passwordChange)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Current password is incorrect');
        });
    });
});
