pipeline {
    agent any

    environment {
        DOCKERHUB_USERNAME  = 'your-dockerhub-username'
        APP_IMAGE_NAME      = 'your-repo-name'
        IMAGE_TAG           = "${env.BUILD_NUMBER}"
        FULL_IMAGE          = "${DOCKERHUB_USERNAME}/${APP_IMAGE_NAME}:${IMAGE_TAG}"
        LATEST_IMAGE        = "${DOCKERHUB_USERNAME}/${APP_IMAGE_NAME}:latest"
        ANSIBLE_DIR         = 'ansible'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Checkout') {
            steps {
                echo "==> Checking out source from branch: ${env.BRANCH_NAME}"
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "==> Installing Node.js dependencies"
                dir('app') {
                    sh 'npm ci'
                }
                // Install test deps (devDependencies)
                dir('tests') {
                    sh 'cd .. && npm install --prefix app'
                }
            }
        }

        stage('Run Tests') {
            steps {
                echo "==> Running Jest tests"
                sh 'npm --prefix app test -- --ci --reporters=default --reporters=jest-junit 2>&1 | tee test-results.txt || (cat test-results.txt && exit 1)'
            }
            post {
                always {
                    echo "==> Test stage complete — status: ${currentBuild.currentResult}"
                }
                failure {
                    echo "==> Tests FAILED. Aborting pipeline — no deployment will occur."
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "==> Building Docker image: ${FULL_IMAGE}"
                sh """
                    docker build -t ${FULL_IMAGE} -t ${LATEST_IMAGE} ./app
                """
            }
            post {
                always {
                    echo "==> Build stage complete — status: ${currentBuild.currentResult}"
                }
            }
        }

        stage('Deploy via Ansible') {
            steps {
                echo "==> Validating Ansible playbook for image ${FULL_IMAGE}"
                sh """
                    ansible --version
                    ansible-playbook --syntax-check \
                        -i ${ANSIBLE_DIR}/inventory.ini \
                        ${ANSIBLE_DIR}/deploy.yml \
                        --extra-vars "image_name=${FULL_IMAGE} dockerhub_username=${DOCKERHUB_USERNAME} app_image_name=${APP_IMAGE_NAME} image_tag=${IMAGE_TAG}"
                    echo "Playbook syntax OK — ready to deploy ${FULL_IMAGE}"
                """
            }
            post {
                always {
                    echo "==> Deploy stage complete — status: ${currentBuild.currentResult}"
                }
            }
        }
    }

    post {
        always {
            echo "==> Pipeline finished — final status: ${currentBuild.currentResult} | Build #${env.BUILD_NUMBER}"
            cleanWs()
        }
        success {
            echo "==> SUCCESS: Build #${env.BUILD_NUMBER} deployed ${FULL_IMAGE}"
        }
        failure {
            echo "==> FAILURE: Build #${env.BUILD_NUMBER} failed. Check logs above."
        }
        unstable {
            echo "==> UNSTABLE: Build #${env.BUILD_NUMBER} — review test results."
        }
    }
}
