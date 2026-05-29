# User Management API - DevOps CI/CD Pipeline

A fully automated CI/CD pipeline built with Jenkins for a Node.js REST API, demonstrating all 7 stages of a professional DevOps workflow.

## Project Overview

This project is a **User Management REST API** built with Express.js that supports full CRUD operations with input validation, security headers, structured logging, and Prometheus metrics.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Application | Node.js, Express.js |
| Testing | Jest, Supertest |
| Code Quality | ESLint, SonarQube |
| Security | npm audit, OWASP Dependency-Check |
| Containerization | Docker, Docker Compose |
| CI/CD | Jenkins |
| Monitoring | Prometheus, Grafana |
| Logging | Winston |

## Pipeline Stages

### 1. Build
- Installs dependencies via `npm ci`
- Builds a multi-stage Docker image
- Tags images with build number and `latest`
- Archives build artefacts

### 2. Test
- Runs unit tests and integration tests in parallel
- Generates code coverage reports
- Publishes HTML coverage report in Jenkins

### 3. Code Quality
- ESLint static analysis with custom rules
- SonarQube analysis for code smells, duplication, and complexity
- Quality gate enforcement

### 4. Security
- `npm audit` for dependency vulnerabilities
- OWASP Dependency-Check for comprehensive CVE scanning
- Generates JSON and HTML security reports

### 5. Deploy (Staging)
- Deploys Docker container to staging environment (port 3001)
- Health check verification
- Smoke tests against staging endpoints

### 6. Release (Production)
- Tags Docker image with version number
- Deploys to production with monitoring stack
- Production smoke tests
- Rollback capability on failure

### 7. Monitoring & Alerting
- Prometheus scrapes app metrics every 5 seconds
- Grafana dashboard with 8 panels (request rate, response time, errors, memory, CPU)
- Alert rules for high error rate, slow response, and app downtime
- Test traffic generation for dashboard verification

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

## Getting Started

```bash
# Clone the repository
git clone <your-repo-url>
cd devops-pipeline-project

# Install dependencies
npm install

# Run locally
npm start

# Run tests
npm test
```

## Jenkins Setup

See the Jenkinsfile for the complete pipeline configuration. Required Jenkins plugins:
- NodeJS Plugin
- Docker Pipeline
- SonarQube Scanner
- OWASP Dependency-Check
- HTML Publisher
- Pipeline

## Author

[Your Name] - SIT753 Professional Practice in IT
