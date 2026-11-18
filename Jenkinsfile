pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'ri5u'
        APP_PRIVATE_IP = '10.0.2.47'
        IMAGE_TAG      = "${env.GIT_COMMIT.take(7)}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Images') {
            steps {
                sh "docker build -t ${DOCKERHUB_USER}/ai-interview-backend:${IMAGE_TAG} ./backend"
                sh "docker build -t ${DOCKERHUB_USER}/ai-interview-frontend:${IMAGE_TAG} ./frontend"
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh "docker push ${DOCKERHUB_USER}/ai-interview-backend:${IMAGE_TAG}"
                    sh "docker push ${DOCKERHUB_USER}/ai-interview-frontend:${IMAGE_TAG}"
                }
            }
        }

        stage('Deploy to Application EC2') {
            steps {
                sshagent(['app-ec2-ssh']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ubuntu@${APP_PRIVATE_IP} '
                            cd ~/app &&
                            sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env &&
                            docker compose pull &&
                            docker compose up -d &&
                            sleep 3 &&
                            curl -sf http://localhost:8080/health
                        '
                    """
                }
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f'
        }
    }
}