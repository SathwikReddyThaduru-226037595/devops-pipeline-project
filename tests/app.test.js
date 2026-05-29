const request = require('supertest');
const app = require('../src/app');

describe('Health Check', () => {
  test('GET /health should return healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

describe('User API - GET', () => {
  test('GET /api/users should return all users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/users/1 should return a specific user', async () => {
    const res = await request(app).get('/api/users/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('id', 1);
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).toHaveProperty('role');
  });

  test('GET /api/users/999 should return 404', async () => {
    const res = await request(app).get('/api/users/999');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'User not found');
  });

  test('GET /api/users/invalid should return 400', async () => {
    const res = await request(app).get('/api/users/abc');
    expect(res.statusCode).toBe(400);
  });
});

describe('User API - POST', () => {
  test('POST /api/users should create a new user', async () => {
    const newUser = { name: 'Charlie Brown', email: 'charlie@example.com', role: 'user' };
    const res = await request(app).post('/api/users').send(newUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('Charlie Brown');
    expect(res.body.data.email).toBe('charlie@example.com');
  });

  test('POST /api/users with invalid email should return 400', async () => {
    const badUser = { name: 'Test', email: 'not-an-email', role: 'user' };
    const res = await request(app).post('/api/users').send(badUser);
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });

  test('POST /api/users with missing fields should return 400', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Test' });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/users with invalid role should return 400', async () => {
    const badUser = { name: 'Test', email: 'test@test.com', role: 'superadmin' };
    const res = await request(app).post('/api/users').send(badUser);
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/users with duplicate email should return 409', async () => {
    const dupUser = { name: 'Duplicate', email: 'alice@example.com', role: 'user' };
    const res = await request(app).post('/api/users').send(dupUser);
    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('error', 'Email already exists');
  });
});

describe('User API - PUT', () => {
  test('PUT /api/users/2 should update user', async () => {
    const updated = { name: 'Bob Updated', email: 'bob.updated@example.com', role: 'moderator' };
    const res = await request(app).put('/api/users/2').send(updated);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe('Bob Updated');
  });

  test('PUT /api/users/999 should return 404', async () => {
    const updated = { name: 'Nobody', email: 'nobody@example.com', role: 'user' };
    const res = await request(app).put('/api/users/999').send(updated);
    expect(res.statusCode).toBe(404);
  });
});

describe('User API - DELETE', () => {
  test('DELETE /api/users/1 should delete user', async () => {
    const res = await request(app).delete('/api/users/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('id', 1);
  });

  test('DELETE /api/users/999 should return 404', async () => {
    const res = await request(app).delete('/api/users/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('Error Handling', () => {
  test('GET /nonexistent should return 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found');
  });
});

describe('Metrics Endpoint', () => {
  test('GET /metrics should return Prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
  });
});
