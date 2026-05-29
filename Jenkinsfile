pipeline {
    agent any

    tools {
        nodejs 'NodeJS-18'
    }

    environment {
        APP_NAME = 'user-management-api'
        DOCKER_IMAGE = "user-management-api"
        STAGING_PORT = '3001'
        PRODUCTION_PORT = '3000'
        SCANNER_HOME = tool 'SonarScanner'
    }

    stages {

        // ==========================================
        // STAGE 1: BUILD
        // ==========================================
        stage('Build') {
            steps {
                echo '=== STAGE 1: BUILD ==='
                echo 'Installing dependencies...'
                sh 'npm ci'

                echo 'Building application...'
                sh 'npm run build'

                echo 'Building Docker image...'
                sh "docker build -t ${DOCKER_IMAGE}:${BUILD_NUMBER} -t ${DOCKER_IMAGE}:latest ."

                echo 'Verifying build artefact...'
                sh "docker images ${DOCKER_IMAGE}:${BUILD_NUMBER}"
            }
            post {
                success {
                    echo 'Build stage completed successfully!'
                    archiveArtifacts artifacts: 'package.json', fingerprint: true
                }
                failure {
                    echo 'Build stage failed!'
                }
            }
        }

        // ==========================================
        // STAGE 2: TEST
        // ==========================================
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        echo '=== STAGE 2a: UNIT TESTS ==='
                        sh 'npm run test:unit'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        echo '=== STAGE 2b: INTEGRATION TESTS ==='
                        sh 'npm run test:integration'
                    }
                }
            }
            post {
                always {
                    echo 'Publishing test results and coverage...'
                    sh 'npm run test:coverage || true'
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
                success {
                    echo 'All tests passed!'
                }
                failure {
                    echo 'Tests failed! Pipeline will be stopped.'
                }
            }
        }

        // ==========================================
        // STAGE 3: CODE QUALITY
        // ==========================================
        stage('Code Quality') {
            steps {
                echo '=== STAGE 3: CODE QUALITY ANALYSIS ==='

                echo 'Running ESLint...'
                sh 'npx eslint src/ tests/ --format json --output-file eslint-report.json || true'
                sh 'npx eslint src/ tests/ || true'

                echo 'Running SonarQube analysis...'
                withSonarQubeEnv('SonarQube') {
                    sh """
                        ${SCANNER_HOME}/bin/sonar-scanner \
                        -Dsonar.projectKey=${APP_NAME} \
                        -Dsonar.projectName='User Management API' \
                        -Dsonar.sources=src \
                        -Dsonar.tests=tests \
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                        -Dsonar.eslint.reportPaths=eslint-report.json
                    """
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'eslint-report.json', allowEmptyArchive: true
                }
                success {
                    echo 'Code quality analysis completed!'
                }
            }
        }

        // ==========================================
        // STAGE 4: SECURITY
        // ==========================================
        stage('Security') {
            steps {
                echo '=== STAGE 4: SECURITY SCANNING ==='

                echo 'Running npm audit for dependency vulnerabilities...'
                sh 'npm audit --audit-level=moderate || true'
                sh 'npm audit --json > npm-audit-report.json || true'

                echo 'Running OWASP Dependency-Check...'
                dependencyCheck additionalArguments: '''
                    --scan .
                    --format HTML
                    --format JSON
                    --prettyPrint
                    --disableYarnAudit
                ''', odcInstallation: 'OWASP-DepCheck'

                dependencyCheckPublisher pattern: '**/dependency-check-report.json',
                    failedTotalCritical: 1,
                    failedTotalHigh: 5,
                    unstableTotalMedium: 10
            }
            post {
                always {
                    archiveArtifacts artifacts: 'npm-audit-report.json', allowEmptyArchive: true
                    archiveArtifacts artifacts: '**/dependency-check-report.*', allowEmptyArchive: true
                }
                success {
                    echo 'Security scan completed!'
                }
            }
        }

        // ==========================================
        // STAGE 5: DEPLOY TO STAGING
        // ==========================================
        stage('Deploy to Staging') {
            steps {
                echo '=== STAGE 5: DEPLOY TO STAGING ==='

                echo 'Stopping any existing staging containers...'
                sh 'docker-compose -f docker-compose.staging.yml down || true'

                echo 'Deploying to staging environment...'
                sh 'docker-compose -f docker-compose.staging.yml up -d'

                echo 'Waiting for staging to become healthy...'
                sh '''
                    echo "Waiting for app to start..."
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

                echo 'Running smoke tests on staging...'
                sh '''
                    echo "Testing GET /api/users..."
                    curl -s http://localhost:3001/api/users | grep -q "data"
                    echo "Testing GET /health..."
                    curl -s http://localhost:3001/health | grep -q "healthy"
                    echo "All smoke tests passed!"
                '''
            }
            post {
                success {
                    echo 'Staging deployment successful!'
                }
                failure {
                    echo 'Staging deployment failed!'
                    sh 'docker-compose -f docker-compose.staging.yml logs'
                    sh 'docker-compose -f docker-compose.staging.yml down || true'
                }
            }
        }

        // ==========================================
        // STAGE 6: RELEASE TO PRODUCTION
        // ==========================================
        stage('Release to Production') {
            steps {
                echo '=== STAGE 6: RELEASE TO PRODUCTION ==='

                echo 'Tagging Docker image for production release...'
                sh """
                    docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:production
                    docker tag ${DOCKER_IMAGE}:${BUILD_NUMBER} ${DOCKER_IMAGE}:v1.0.${BUILD_NUMBER}
                """

                echo 'Stopping staging environment...'
                sh 'docker-compose -f docker-compose.staging.yml down || true'

                echo 'Deploying to production with monitoring stack...'
                sh 'docker-compose -f docker-compose.production.yml up -d'

                echo 'Waiting for production to become healthy...'
                sh '''
                    echo "Waiting for production app to start..."
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

                echo 'Running production smoke tests...'
                sh '''
                    curl -s http://localhost:3000/health | grep -q "healthy"
                    curl -s http://localhost:3000/api/users | grep -q "data"
                    curl -s http://localhost:3000/metrics | grep -q "http_requests_total"
                    echo "All production smoke tests passed!"
                '''
            }
            post {
                success {
                    echo "Production release v1.0.${BUILD_NUMBER} deployed successfully!"
                }
                failure {
                    echo 'Production release failed! Rolling back...'
                    sh 'docker-compose -f docker-compose.production.yml down || true'
                }
            }
        }

        // ==========================================
        // STAGE 7: MONITORING & ALERTING
        // ==========================================
        stage('Monitoring & Alerting') {
            steps {
                echo '=== STAGE 7: MONITORING & ALERTING ==='

                echo 'Verifying Prometheus is scraping metrics...'
                sh '''
                    for i in $(seq 1 15); do
                        if curl -s http://localhost:9090/-/healthy | grep -q "OK"; then
                            echo "Prometheus is healthy!"
                            break
                        fi
                        echo "Waiting for Prometheus... attempt $i"
                        sleep 3
                    done
                '''

                echo 'Verifying Grafana is running...'
                sh '''
                    for i in $(seq 1 15); do
                        if curl -s http://localhost:3002/api/health | grep -q "ok"; then
                            echo "Grafana is healthy!"
                            break
                        fi
                        echo "Waiting for Grafana... attempt $i"
                        sleep 3
                    done
                '''

                echo 'Generating test traffic for monitoring...'
                sh '''
                    for i in $(seq 1 20); do
                        curl -s http://localhost:3000/api/users > /dev/null
                        curl -s http://localhost:3000/health > /dev/null
                        curl -s -X POST http://localhost:3000/api/users \
                            -H "Content-Type: application/json" \
                            -d '{"name":"Test User '$i'","email":"test'$i'@example.com","role":"user"}' > /dev/null
                    done
                    echo "Test traffic generated!"
                '''

                echo 'Verifying metrics are being collected...'
                sh '''
                    sleep 10
                    METRICS=$(curl -s http://localhost:3000/metrics)
                    echo "$METRICS" | grep "http_requests_total"
                    echo "$METRICS" | grep "http_request_duration_seconds"
                    echo "Metrics verified!"
                '''

                echo 'Verifying alert rules are loaded...'
                sh '''
                    curl -s http://localhost:9090/api/v1/rules | grep -q "HighErrorRate" && echo "Alert rules loaded!"
                '''

                echo '============================================'
                echo 'MONITORING DASHBOARD URLs:'
                echo '  Grafana:    http://localhost:3002'
                echo '              Login: admin / admin'
                echo '  Prometheus: http://localhost:9090'
                echo '  App Health: http://localhost:3000/health'
                echo '  App Metrics: http://localhost:3000/metrics'
                echo '============================================'
            }
            post {
                success {
                    echo 'Monitoring and alerting fully configured!'
                }
            }
        }
    }

    // ==========================================
    // POST-PIPELINE ACTIONS
    // ==========================================
    post {
        always {
            echo '=== PIPELINE COMPLETE ==='
            echo "Build Number: ${BUILD_NUMBER}"
            echo "Build Status: ${currentBuild.currentResult}"
        }
        success {
            echo '''
            =============================================
            PIPELINE SUCCEEDED!
            All 7 stages completed successfully.
            Application deployed to production.
            Monitoring active at http://localhost:3002
            =============================================
            '''
        }
        failure {
            echo 'Pipeline failed. Check the logs for details.'
            sh 'docker-compose -f docker-compose.staging.yml down || true'
        }
    }
}
