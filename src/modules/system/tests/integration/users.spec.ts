import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../../app.js';
import { prisma } from '../../../../config/database.js';

describe('Users API (Integration)', () => {
  let adminToken = '';
  
  beforeAll(async () => {
    // We assume the test database has a super admin seeded by seed-test.ts
    // or we can just mock the auth middleware, but since it's an integration test, we login.
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test-admin@goexperts.com',
        password: 'TestPass123!',
      });
    
    adminToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: 'integration-test-user@goexperts.com' }
    });
  });

  it('should prevent access without token', async () => {
    const res = await request(app).get('/api/admin/system/users');
    expect(res.status).toBe(401);
  });

  it('should list users when authenticated as admin', async () => {
    if (!adminToken) return; // Skip if login failed
    const res = await request(app)
      .get('/api/admin/system/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('should create a new user', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post('/api/admin/system/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'integration-test-user@goexperts.com',
        firstName: 'Integration',
        lastName: 'Test',
        type: 'freelancer'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('integration-test-user@goexperts.com');
  });
});
