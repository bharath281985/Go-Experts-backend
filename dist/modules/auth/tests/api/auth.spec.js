import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../../app.js';
import { prisma } from '../../../../config/database.js';
import bcrypt from 'bcrypt';
describe('Auth API (Integration)', () => {
    beforeAll(async () => {
        // Setup test user
        const hashedPassword = await bcrypt.hash('TestPass123!', 10);
        await prisma.role.upsert({
            where: { name: 'super_admin' },
            update: {},
            create: {
                id: 'super_admin',
                name: 'super_admin',
                description: 'Super Admin Role',
            }
        });
        await prisma.adminUser.upsert({
            where: { email: 'test-login@goexperts.com' },
            update: { password: hashedPassword },
            create: {
                email: 'test-login@goexperts.com',
                password: hashedPassword,
                fullName: 'Test Login User',
                status: 'active',
                roleId: 'super_admin',
            },
        });
    });
    afterAll(async () => {
        // Cleanup
        await prisma.adminUser.delete({ where: { email: 'test-login@goexperts.com' } });
    });
    it('should reject login with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
            email: 'test-login@goexperts.com',
            password: 'wrongpassword',
        });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
    it('should login successfully with valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
            email: 'test-login@goexperts.com',
            password: 'TestPass123!',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
    });
});
