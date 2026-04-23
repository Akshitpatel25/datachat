# 🗄️ DataChat — AI-Powered Data Catalog Assistant

Ask questions about your data in plain English. DataChat connects to [OpenMetadata](https://open-metadata.org/) and uses an AI agent to search tables, trace lineage, find PII, and explore your entire data catalog — no SQL or technical skills needed.

![DataChat](https://img.shields.io/badge/React-Frontend-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green) ![OpenMetadata](https://img.shields.io/badge/OpenMetadata-Catalog-orange) ![LangChain](https://img.shields.io/badge/LangChain-Agent-purple)

## What It Does

- **Natural language search** — "What tables contain customer data?" → instant results
- **Column explorer** — "What columns does the fact_session table have?" → 31 columns listed
- **Data lineage** — "Where does dim_address get its data?" → upstream and downstream traced
- **PII detection** — "Find all PII data" → flags sensitive personal data across the catalog
- **Visual analytics** — live dashboard with asset distribution, service breakdown, and tag overview
- **Interactive Data Explorer** — drill down from database → tables → columns with charts
- **Smart suggestions** — follow-up question chips after every answer

## Architecture

```
React (Vite + Tailwind) → FastAPI → LangChain Agent → OpenMetadata REST API
                                         ↓
                                   Groq (Qwen3-32B)
```

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | Chat UI + Analytics panel |
| Backend | 8000 | API server + AI agent |
| OpenMetadata | 8585 | Metadata catalog |
| Airflow | 8080 | Ingestion pipelines |
| MySQL | 3306 | Catalog database |
| Elasticsearch | 9200 | Search engine |

## Prerequisites

- **Docker Desktop** (v20.10+)
- **Python** (3.11+)
- **Node.js** (18+)
- **Git**
- **Groq API Key** — free at [console.groq.com](https://console.groq.com)

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Akshitpatel25/datachat.git
cd datachat
```

### 2. Start OpenMetadata (Docker)

Make sure Docker Desktop is running, then:

```bash
docker compose up --detach
```

This pulls and starts 4 containers (MySQL, Elasticsearch, OpenMetadata Server, Airflow). First run takes a few minutes to download ~3GB of images.

Wait until all containers are healthy:

```bash
docker ps
```

You should see `openmetadata_server`, `openmetadata_mysql`, `openmetadata_elasticsearch`, and `openmetadata_ingestion` all running.

Verify at: [http://localhost:8585](http://localhost:8585)
- Username: `admin@open-metadata.org`
- Password: `admin`

### 3. Set up the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

If `pydantic-core` fails to build (Python 3.14+), run this first:
```bash
pip install --only-binary pydantic-core pydantic-core
pip install -r requirements.txt
```

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `backend/.env` and add your Groq API key:

```env
OPENMETADATA_HOST=http://localhost:8585
OPENMETADATA_USERNAME=admin@open-metadata.org
OPENMETADATA_PASSWORD=admin
GROQ_API_KEY=gsk_your_real_key_here
```

Get a free Groq key at [console.groq.com](https://console.groq.com).

### 5. Start the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Verify at: [http://localhost:8000/health](http://localhost:8000/health) — should return `{"status": "ok", "openmetadata": "connected"}`.

### 6. Set up the Frontend

```bash
cd frontend
npm install
npm run dev
```

### 7. Open DataChat

Go to [http://localhost:5173](http://localhost:5173) and start chatting!

## Sample Questions to Try

- "What tables are available in my data catalog?"
- "What columns does the fact_session table have?"
- "What is the lineage of the dim_address table?"
- "Show me all PII data assets"
- "Find all dashboards"
- "Who owns the customer data?"

## Project Structure

```
datachat/
├── backend/
│   ├── main.py                 # FastAPI server + all API endpoints
│   ├── agent.py                # LangChain AI agent with 10 tools
│   ├── openmetadata_client.py  # OpenMetadata REST API client
│   ├── requirements.txt        # Python dependencies
│   ├── test_agent.py           # Smoke tests
│   └── .env.example            # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main chat UI + analytics panel
│   │   ├── App.css             # Tailwind + custom styles
│   │   ├── DataExplorer.jsx    # Interactive data explorer component
│   │   └── main.jsx            # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml          # OpenMetadata stack
├── .env.example                # Root env template
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send a question, get an AI-powered answer |
| GET | `/health` | Health check + catalog stats |
| GET | `/sample-questions` | Get example questions |
| GET | `/analytics` | Dashboard data (totals, charts, tags) |
| POST | `/trigger-sample-data` | Trigger Airflow sample DAGs |
| GET | `/explorer/databases` | List database services |
| GET | `/explorer/tables?service=X` | List tables for a service |
| GET | `/explorer/columns?tables=FQN` | Get columns for tables |

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Recharts, React-Markdown
- **Backend**: Python, FastAPI, LangChain, LangGraph
- **AI**: Qwen3-32B via Groq (free tier)
- **Metadata**: OpenMetadata 1.12.5
- **Infrastructure**: Docker Compose (MySQL, Elasticsearch, Airflow)

## Stopping Everything

```bash
# Stop frontend: Ctrl+C in the terminal

# Stop backend: Ctrl+C in the terminal

# Stop OpenMetadata:
docker compose down

# Stop and wipe all data:
docker compose down --volumes
```

## Troubleshooting

### Docker Issues

**"docker" is not recognized / Docker daemon not running**
```
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/..."
```
→ Docker Desktop is not running. Open Docker Desktop from the Start menu and wait until the whale icon in the system tray shows "Docker Desktop is running". Then retry.

**Port 3306/8585/9200 already in use**
```
Bind for 0.0.0.0:3306 failed: port is already allocated
```
→ Another service is using that port. Stop it first:
```bash
# Find what's using the port (Windows):
netstat -ano | findstr :3306
# Kill it:
taskkill /PID <PID_NUMBER> /F
```
Or change the port in `docker-compose.yml`.

**OpenMetadata containers keep restarting**
```bash
docker logs openmetadata_server
```
→ Check if MySQL and Elasticsearch are healthy first. The server waits for both. If you see `OutOfMemoryError`, increase Docker Desktop memory to at least 4GB (Settings → Resources → Memory).

**Network openmetadata_app_net Error**
```
failed to create network openmetadata_app_net: Pool overlaps with other one
```
→ Run `docker network prune` to clean up unused networks, then retry.

### Python Issues

**"python" is not recognized**
→ Python is not installed or not in PATH. Download from [python.org](https://www.python.org/downloads/). During installation, check "Add Python to PATH".

**pydantic-core fails to build (Python 3.13+)**
```
Failed to build installable wheels for pydantic-core
```
→ Your Python version is too new for pre-built wheels. Fix:
```bash
pip install --only-binary pydantic-core pydantic-core
pip install -r requirements.txt
```

**pip install hangs or is very slow**
→ The `openmetadata-ingestion` package has many dependencies (~200). It can take 5-10 minutes on slow connections. Be patient, or use a faster mirror:
```bash
pip install -r requirements.txt -i https://pypi.org/simple/
```

**ModuleNotFoundError: No module named 'xxx'**
→ You're not in the virtual environment. Activate it first:
```bash
# Windows:
backend\venv\Scripts\activate
# macOS/Linux:
source backend/venv/bin/activate
```

### Backend Issues

**"Password needs to be encoded in Base-64"**
→ This is already handled in the code. If you see this, make sure you're using the latest version of `openmetadata_client.py`.

**"Please set a real Groq API key in .env"**
→ Edit `backend/.env` and replace `gsk_your_real_key_here` with your actual key from [console.groq.com](https://console.groq.com).

**"Please reduce the length of the messages or completion" (400 error)**
→ The conversation got too long. Simply refresh the browser page to start a fresh conversation. This resets the conversation ID and clears the history.

**"Failed to call a function" / tool_use_failed**
→ This can happen with certain LLM models. The project uses `qwen/qwen3-32b` which handles tool calling reliably. If you switched models, switch back:
```python
# In backend/agent.py
llm = ChatGroq(model="qwen/qwen3-32b", ...)
```

**429 Too Many Requests from Groq**
→ You've hit Groq's free tier rate limit. The SDK retries automatically with backoff. If it persists, wait 60 seconds or upgrade your Groq plan.

### Frontend Issues

**"npm" is not recognized**
→ Node.js is not installed. Download from [nodejs.org](https://nodejs.org/) (LTS version recommended).

**Port 5173 already in use**
→ Vite will automatically try the next port (5174, 5175, etc.). Check the terminal output for the actual URL.

**CORS errors in browser console**
```
Access to fetch at 'http://localhost:8000' has been blocked by CORS policy
```
→ The backend isn't running, or it crashed. Check the backend terminal for errors and restart:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Chat shows "Could not connect to the DataChat backend"**
→ The backend at `http://localhost:8000` is not reachable. Make sure:
1. The backend is running (`uvicorn main:app --reload --port 8000`)
2. OpenMetadata is running (`docker ps` should show 4 containers)
3. No firewall is blocking localhost connections

### OpenMetadata Issues

**No tables/dashboards showing up (empty catalog)**
→ This is a fresh install. OpenMetadata ships with sample data that gets ingested via Airflow. Check if the sample DAGs ran:
1. Go to [http://localhost:8080](http://localhost:8080) (Airflow)
2. Login: admin / admin
3. Check if sample data DAGs have run successfully

**Login fails at localhost:8585**
→ Default credentials are `admin@open-metadata.org` / `admin`. The server takes 1-2 minutes to fully start after `docker compose up`. Wait and retry.

## License

MIT

---

Built for a hackathon 🚀
