const request = require('supertest');
const app = require('../src/app');

describe('Integration: Full User Lifecycle', () => {
  let createdUserId;

  test('Step 1: Create a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Integration Test User', email: 'integration@test.com', role: 'moderator' });

    expect(res.statusCode).toBe(201);
    createdUserId = res.body.data.id;
    expect(createdUserId).toBeDefined();
  });

  test('Step 2: Retrieve the created user', async () => {
    const res = await request(app).get(`/api/users/${createdUserId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe('integration@test.com');
  });

  test('Step 3: Update the user', async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .send({ name: 'Updated Integration User', email: 'updated@test.com', role: 'admin' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Updated Integration User');
  });

  test('Step 4: Verify update persisted', async () => {
    const res = await request(app).get(`/api/users/${createdUserId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Updated Integration User');
    expect(res.body.data.email).toBe('updated@test.com');
  });

  test('Step 5: Delete the user', async () => {
    const res = await request(app).delete(`/api/users/${createdUserId}`);
    expect(res.statusCode).toBe(200);
  });

  test('Step 6: Verify user is deleted', async () => {
    const res = await request(app).get(`/api/users/${createdUserId}`);
    expect(res.statusCode).toBe(404);
  });
});

describe('Integration: Input Validation & Security', () => {
  test('XSS attempt in name should be sanitized', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: '<script>alert("xss")</script>', email: 'xss@test.com', role: 'user' });

    if (res.statusCode === 201) {
      expect(res.body.data.name).not.toContain('<script>');
    }
  });

  test('SQL injection attempt in name should be handled', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: "Robert'; DROP TABLE users;--", email: 'sql@test.com', role: 'user' });

    expect([201, 400]).toContain(res.statusCode);
  });

  test('Very long name should be rejected', async () => {
    const longName = 'A'.repeat(200);
    const res = await request(app)
      .post('/api/users')
      .send({ name: longName, email: 'long@test.com', role: 'user' });

    expect(res.statusCode).toBe(400);
  });
});
