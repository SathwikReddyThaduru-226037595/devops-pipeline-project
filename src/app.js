const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { body, param, validationResult } = require('express-validator');
const logger = require('./logger');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(metricsMiddleware);

// In-memory data store
let users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
];
let nextId = 3;

// Validation helpers
const userValidation = [
  body('name').isString().isLength({ min: 2, max: 100 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'user', 'moderator']),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validation failed: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsEndpoint);

// GET all users
app.get('/api/users', (req, res) => {
  logger.info('Fetching all users');
  res.json({ data: users, total: users.length });
});

// GET user by ID
app.get('/api/users/:id', param('id').isInt({ min: 1 }), handleValidation, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    logger.warn(`User not found: ${req.params.id}`);
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ data: user });
});

// POST create user
app.post('/api/users', userValidation, handleValidation, (req, res) => {
  const { name, email, role } = req.body;

  // Check duplicate email
  if (users.find(u => u.email === email)) {
    logger.warn(`Duplicate email attempt: ${email}`);
    return res.status(409).json({ error: 'Email already exists' });
  }

  const newUser = { id: nextId++, name, email, role };
  users.push(newUser);
  logger.info(`User created: ${newUser.id}`);
  res.status(201).json({ data: newUser });
});

// PUT update user
app.put('/api/users/:id', param('id').isInt({ min: 1 }), userValidation, handleValidation, (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, email, role } = req.body;
  users[index] = { ...users[index], name, email, role };
  logger.info(`User updated: ${req.params.id}`);
  res.json({ data: users[index] });
});

// DELETE user
app.delete('/api/users/:id', param('id').isInt({ min: 1 }), handleValidation, (req, res) => {
  const index = users.findIndex(u => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const deleted = users.splice(index, 1);
  logger.info(`User deleted: ${req.params.id}`);
  res.json({ data: deleted[0] });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
