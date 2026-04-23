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
git clone https://github.com/YOUR_USERNAME/datachat.git
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
│   ├── agent.py                # LangChain AI agent with 7 tools
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

## License

MIT

---

Built for a hackathon 🚀
