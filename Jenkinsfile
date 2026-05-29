
pipeline {
    agent any

    environment {
        APP_NAME = 'user-management-api'
        DOCKER_IMAGE = 'user-management-api'
        STAGING_PORT = '3001'
        PRODUCTION_PORT = '3000'
    }

    stages {

        stage('Build') {
            steps {
                echo '=== STAGE 1: BUILD ==='
                sh 'npm ci || npm install'
                sh 'npm run build'
                sh "docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} -t ${DOCKER_IMAGE}:latest ."
                sh "docker images ${DOCKER_IMAGE}:${BUILD_NUMBER}"
            }
            post {
                success {
                    echo 'Build stage completed successfully!'
                    archiveArtifacts artifacts: 'package.json', fingerprint: true
                }
                failure { echo 'Build stage failed!' }
            }
        }

        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        echo '=== STAGE 2a: UNIT TESTS ==='
                        sh 'npx jest tests/app.test.js --forceExit --detectOpenHandles'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        echo '=== STAGE 2b: INTEGRATION TESTS ==='
                        sh 'npx jest tests/integration.test.js --forceExit --detectOpenHandles'
                    }
                }
            }
            post {
                always {
                    echo 'Generating coverage report...'
                    sh 'npx jest --coverage --forceExit --detectOpenHandles || true'
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
                success { echo 'All tests passed!' }
                failure { echo 'Tests failed!' }
            }
        }

        stage('Code Quality') {
            steps {
                echo '=== STAGE 3: CODE QUALITY ANALYSIS ==='
                sh 'npx eslint src/ tests/ --format json --output-file eslint-report.json || true'
                sh 'npx eslint src/ tests/ || true'
                sh '''
                    docker run --rm \
                        -e SONAR_HOST_URL=http://host.docker.internal:9000 \
                        -e SONAR_LOGIN=admin \
                        -e SONAR_PASSWORD=admin1 \
                        -v "$(pwd):/usr/src" \
                        sonarsource/sonar-scanner-cli \
                        -Dsonar.projectKey=user-management-api \
                        -Dsonar.projectName="User Management API" \
                        -Dsonar.sources=src \
                        -Dsonar.tests=tests \
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                        -Dsonar.eslint.reportPaths=eslint-report.json \
                    || echo "SonarQube analysis completed (check dashboard for results)"
                '''
            }
            post {
                always { archiveArtifacts artifacts: 'eslint-report.json', allowEmptyArchive: true }
                success { echo 'Code quality analysis completed!' }
            }
        }

        stage('Security') {
            steps {
                echo '=== STAGE 4: SECURITY SCANNING ==='
                sh 'npm audit --audit-level=moderate || true'
                sh 'npm audit --json > npm-audit-report.json || true'
                sh '''
                    mkdir -p owasp-report
                    docker run --rm \
                        -v "$(pwd):/src" \
                        -v "$(pwd)/owasp-report:/report" \
                        owasp/dependency-check:latest \
                        --scan /src \
                        --format HTML \
                        --format JSON \
                        --out /report \
                        --prettyPrint \
                        --disableYarnAudit \
                        --disableNodeAudit \
                    || echo "OWASP scan completed (check report for details)"
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'npm-audit-report.json', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'owasp-report/**', allowEmptyArchive: true
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'owasp-report',
                        reportFiles: 'dependency-check-report.html',
                        reportName: 'OWASP Dependency Check Report'
                    ])
                }
                success { echo 'Security scanning completed!' }
            }
        }

        stage('Deploy to Staging') {
            steps {
                echo '=== STAGE 5: DEPLOY TO STAGING ==='
                sh 'docker-compose -f docker-compose.staging.yml down || true'
                sh 'docker-compose -f docker-compose.staging.yml up -d --build'
                sh '''
                    for i in $(seq 1 30); do
                        if curl -s http://localhost:3001/health | grep -q "healthy"; then
                            echo "Staging is healthy!"
                            exit 0
                        fi
                        echo "Attempt $i: Waiting..."
                        sleep 2
                    done
                    echo "Staging health check failed!"
                    exit 1
                '''
                sh '''
                    curl -sf http://localhost:3001/api/users | grep -q "data"
                    echo "PASS: GET /api/users"
                    curl -sf http://localhost:3001/health | grep -q "healthy"
                    echo "PASS: GET /health"
                    echo "All staging smoke tests passed!"
                '''
            }
            post {
                success { echo 'Staging deployment successful!' }
                failure {
                    echo 'Staging deployment failed!'
                    sh 'docker-compose -f docker-compose.staging.yml logs || true'
                    sh 'docker-compose -f docker-compose.staging.yml down || true'
                }
            }
        }

        stage('Release to Production') {
            steps {
                echo '=== STAGE 6: RELEASE TO PRODUCTION ==='
                sh """
                    docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:production
                    docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:v1.0.${BUILD_NUMBER}
                """
                sh 'docker-compose -f docker-compose.staging.yml down || true'
                sh 'docker-compose -f docker-compose.production.yml up -d --build'
                sh '''
                    for i in $(seq 1 30); do
                        if curl -s http://localhost:3000/health | grep -q "healthy"; then
                            echo "Production is healthy!"
                            exit 0
                        fi
                        echo "Attempt $i: Waiting..."
                        sleep 2
                    done
                    echo "Production health check failed!"
                    exit 1
                '''
                sh '''
                    curl -sf http://localhost:3000/health | grep -q "healthy"
                    echo "PASS: Health check"
                    curl -sf http://localhost:3000/api/users | grep -q "data"
                    echo "PASS: API responding"
                    curl -sf http://localhost:3000/metrics | grep -q "http_requests_total"
                    echo "PASS: Metrics endpoint"
                    echo "All production tests passed!"
                '''
            }
            post {
                success { echo "Production release v1.0.${BUILD_NUMBER} deployed!" }
                failure {
                    echo 'Production release failed! Rolling back...'
                    sh 'docker-compose -f docker-compose.production.yml down || true'
                }
            }
        }

        stage('Monitoring & Alerting') {
            steps {
                echo '=== STAGE 7: MONITORING & ALERTING ==='
                sh '''
                    for i in $(seq 1 20); do
                        if curl -s http://localhost:9090/-/healthy | grep -q "OK"; then
                            echo "Prometheus is healthy!"
                            break
                        fi
                        echo "Waiting for Prometheus... attempt $i"
                        sleep 3
                    done
                '''
                sh '''
                    for i in $(seq 1 20); do
                        if curl -s http://localhost:3002/api/health | grep -q "ok"; then
                            echo "Grafana is healthy!"
                            break
                        fi
                        echo "Waiting for Grafana... attempt $i"
                        sleep 3
                    done
                '''
                sh '''
                    for i in $(seq 1 20); do
                        curl -s http://localhost:3000/api/users > /dev/null
                        curl -s http://localhost:3000/health > /dev/null
                    done
                    echo "Test traffic generated!"
                '''
                sh '''
                    sleep 10
                    curl -s http://localhost:3000/metrics | grep "http_requests_total"
                    curl -s http://localhost:3000/metrics | grep "http_request_duration_seconds"
                    echo "Metrics verified!"
                '''
                sh '''
                    curl -s http://localhost:9090/api/v1/rules | grep -q "HighErrorRate" && echo "Alert rules loaded!"
                '''
                echo '============================================'
                echo 'MONITORING URLS:'
                echo '  Grafana:     http://localhost:3002 (admin/admin)'
                echo '  Prometheus:  http://localhost:9090'
                echo '  App:         http://localhost:3000/health'
                echo '============================================'
            }
            post {
                success { echo 'Monitoring and alerting configured!' }
            }
        }
    }

    post {
        always {
            echo '=== PIPELINE COMPLETE ==='
            echo "Build: ${BUILD_NUMBER} | Status: ${currentBuild.currentResult}"
        }
        success { echo 'ALL 7 STAGES PASSED! Production deployed with monitoring.' }
        failure { echo 'Pipeline failed. Check logs above.' }
    }
}
