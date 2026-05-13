# Automated CI/CD Pipeline — To-Do App

A complete DevOps reference project: Node.js app → Jenkins CI → Docker Hub → Ansible deploy → Prometheus + Grafana monitoring.

---

## Architecture

```
┌──────────┐   push    ┌─────────┐  build/test  ┌──────────────┐
│  GitHub  │ ────────► │ Jenkins │ ────────────► │ Docker Build │
└──────────┘  webhook  └─────────┘              └──────┬───────┘
                                                        │ push
                                                        ▼
                                               ┌─────────────────┐
                                               │   Docker Hub    │
                                               └────────┬────────┘
                                                        │ pull
                                                        ▼
                                               ┌─────────────────┐
                                               │ Ansible Playbook│
                                               └────────┬────────┘
                                                        │ deploy
                                                        ▼
                                 ┌──────────────────────────────────┐
                                 │         Running App              │
                                 │       (Docker Container)         │
                                 └──────────┬───────────────────────┘
                                            │ :3000/metrics
                          ┌─────────────────▼──────────────────┐
                          │           Prometheus               │
                          │         (scrape every 15s)         │
                          └─────────────────┬──────────────────┘
                                            │ datasource
                          ┌─────────────────▼──────────────────┐
                          │            Grafana                 │
                          │    (dashboards at :3001)           │
                          └────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+ | Bundled with Docker Desktop |
| Node.js | 20 LTS | https://nodejs.org |
| npm | 10+ | Bundled with Node.js |
| Jenkins | 2.440+ | https://www.jenkins.io/download/ |
| Ansible | 2.15+ | `pip install ansible` |
| Python | 3.10+ | https://www.python.org |

---

## Quick Start (local)

### 1. Clone the repository

```bash
git clone https://github.com/your-github-username/your-repo-name.git
cd your-repo-name
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DOCKERHUB_USERNAME and APP_IMAGE_NAME at minimum
```

### 3. Spin up the full stack

```bash
docker compose up --build -d
```

Services started:
| Service | URL |
|---------|-----|
| To-Do App | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

### 4. Access Grafana

- Open http://localhost:3001
- Login: `admin` / `admin` (change via `GF_ADMIN_PASSWORD` in `.env`)
- The **To-Do App Metrics** dashboard is pre-provisioned automatically.

### 5. Run tests locally

```bash
cd app
npm install
npm test
```

### 6. Tear down

```bash
docker compose down -v
```

---

## Jenkins Setup

### Install Jenkins (Docker — recommended for local dev)

```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  jenkins/jenkins:lts-jdk17

# Get initial admin password:
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open http://localhost:8080 and complete the setup wizard. Install the **suggested plugins** plus:
- GitHub plugin
- Docker Pipeline plugin
- Ansible plugin
- SSH Agent plugin

### Add Jenkins Credentials

Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credential**:

| ID | Kind | Usage |
|----|------|-------|
| `dockerhub-credentials` | Username/Password | Docker Hub login |
| `ansible-ssh-key` | SSH Username with private key | SSH to deploy server |

### Create the Pipeline Job

1. **New Item** → **Pipeline** → name it `todo-app-pipeline`
2. Under **Pipeline**:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/your-github-username/your-repo-name.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
3. Check **GitHub hook trigger for GITScm polling**
4. Click **Save**

### Configure the GitHub Webhook

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. **Payload URL**: `http://<your-jenkins-host>:8080/github-webhook/`
   - For local Jenkins: use [ngrok](https://ngrok.com) — `ngrok http 8080` — and use the HTTPS URL.
3. **Content type**: `application/json`
4. **Which events**: `Just the push event`
5. Click **Add webhook**

Jenkins will now trigger a build on every push to `main`.

---

## Updating Placeholder Values

Search for and replace these strings before going to production:

| Placeholder | Replace with |
|-------------|-------------|
| `your-dockerhub-username` | Your Docker Hub username |
| `your-repo-name` | Your Docker Hub repository name |
| `your-github-username` | Your GitHub username |
| `your-server-ip` | IP of your deployment server |

---

## Project Structure

```
.
├── app/
│   ├── index.js          # Express app + Prometheus metrics
│   ├── package.json
│   └── Dockerfile
├── tests/
│   └── app.test.js       # Jest tests (supertest)
├── prometheus/
│   └── prometheus.yml    # Scrape config
├── grafana/
│   └── provisioning/
│       ├── datasources/datasource.yml
│       └── dashboards/
│           ├── dashboard.yml
│           └── todo-app-dashboard.json
├── ansible/
│   ├── inventory.ini
│   ├── ansible.cfg
│   └── deploy.yml
├── Jenkinsfile
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Monitoring Details

- **Scrape interval**: 15 s (configured in `prometheus/prometheus.yml`)
- **Metrics endpoint**: `http://app:3000/metrics`
- **Custom metrics**:
  - `http_requests_total{route, method, status_code}` — counter
  - `http_request_duration_seconds{route, method, status_code}` — histogram
- **Default Node.js metrics**: heap, event loop lag, GC, CPU

### Grafana Panels

| Panel | Query |
|-------|-------|
| HTTP Request Rate | `sum(rate(http_requests_total[1m])) by (route, status_code)` |
| Node.js Heap Memory | `nodejs_heap_size_used_bytes` |
| HTTP Duration p95 | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))` |
| Total Requests (1h) | `sum(increase(http_requests_total[1h]))` |

---

## Ansible Deploy Behaviour

The `deploy.yml` playbook is **idempotent**:
1. Pulls the new image from Docker Hub.
2. Stops and removes the old container.
3. Starts the new container with `restart_policy: unless-stopped`.
4. Waits until the Docker healthcheck reports `healthy`.
5. Prunes dangling images.

---

## License

MIT
