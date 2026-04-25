"""DataChat — FastAPI backend."""

import base64
import logging
import os
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
import fastapi
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import ask_agent
from openmetadata_client import OpenMetadataClient

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-28s  %(levelname)-5s  %(message)s",
)
logger = logging.getLogger("datachat.api")

app = FastAPI(title="DataChat API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- helpers
def _get_om_client() -> OpenMetadataClient:
    return OpenMetadataClient(
        host=os.getenv("OPENMETADATA_HOST", "http://localhost:8585"),
        username=os.getenv("OPENMETADATA_USERNAME", "admin@open-metadata.org"),
        password=os.getenv("OPENMETADATA_PASSWORD", "admin"),
    )


def _get_suggestions(message: str) -> list[str]:
    """Return 2 smart follow-up suggestions based on keywords in the message."""
    msg = message.lower()
    if "lineage" in msg:
        return ["Who owns this data asset?", "Are there any data quality tests?"]
    if "glossary" in msg or "definition" in msg or "mean" in msg:
        return ["Show me all glossary terms", "What governance policies apply?"]
    if "stale" in msg or "fresh" in msg or "outdated" in msg:
        return ["Show me table profiler stats", "Which tables have data quality tests?"]
    if "profile" in msg or "row count" in msg or "rows" in msg:
        return ["Is this table stale?", "Show me the lineage of this table"]
    if "table" in msg:
        return ["What columns does this table have?", "Show me the profiler stats for this table"]
    if "pii" in msg:
        return ["Who owns these PII assets?", "What governance policies apply?"]
    if "dashboard" in msg:
        return ["What data feeds this dashboard?", "Who owns this dashboard?"]
    if "column" in msg:
        return ["Show me the lineage of this table", "Are there data quality tests?"]
    if "quality" in msg:
        return ["Show me the table details", "Which tables are stale?"]
    if "owner" in msg:
        return ["Show me all tables", "Find any PII data"]
    return ["Show me all available tables", "Find any PII data"]


# ---------------------------------------------------------------- models
class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    suggestions: list[str] = []


# -------------------------------------------------------------- routes
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send a natural-language question and get an answer from the agent."""
    cid = req.conversation_id or str(uuid.uuid4())
    logger.info("POST /chat  conversation=%s  message=%s", cid, req.message[:80])
    try:
        answer = await ask_agent(req.message, cid)
    except ValueError as exc:
        answer = str(exc)
    except Exception as exc:
        logger.exception("Agent error")
        answer = f"Sorry, something went wrong: {exc}"
    suggestions = _get_suggestions(req.message)
    return ChatResponse(response=answer, conversation_id=cid, suggestions=suggestions)


@app.get("/health")
def health():
    """Check API and OpenMetadata connectivity, return catalog stats."""
    client = _get_om_client()
    om_ok = client.check_connection()
    stats = {}
    if om_ok:
        try:
            stats = client.get_stats()
        except Exception:
            logger.exception("Failed to fetch stats")
    return {
        "status": "ok",
        "openmetadata": "connected" if om_ok else "disconnected",
        "stats": stats,
    }


@app.post("/trigger-sample-data")
def trigger_sample_data():
    """Trigger sample_lineage and sample_usage DAGs in Airflow."""
    airflow_url = "http://localhost:8080/api/v1/dags"
    creds = base64.b64encode(b"admin:admin").decode()
    headers = {"Authorization": f"Basic {creds}", "Content-Type": "application/json"}
    triggered = []
    for dag_id in ("sample_lineage", "sample_usage"):
        try:
            resp = httpx.post(
                f"{airflow_url}/{dag_id}/dagRuns",
                json={},
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            triggered.append(dag_id)
            logger.info("Triggered DAG: %s", dag_id)
        except Exception as exc:
            logger.warning("Failed to trigger DAG %s: %s", dag_id, exc)
    return {"status": "triggered", "dags": triggered}


@app.get("/sample-questions")
def sample_questions():
    """Return a list of example questions users can try."""
    return [
        "What tables are available in my data catalog?",
        "Show me all datasets that contain PII data",
        "What is the lineage of the dim_address table?",
        "Which tables haven't been updated recently?",
        "What does 'customer lifetime value' mean in our glossary?",
        "Show me profiler stats for the fact_sale table",
    ]


@app.get("/analytics")
def analytics():
    """Return analytics data for the dashboard panel."""
    client = _get_om_client()

    tables = client.get_entity_count("tables")
    dashboards = client.get_entity_count("dashboards")
    pipelines = client.get_entity_count("pipelines")
    topics = client.get_entity_count("topics")

    tables_by_service = client.get_tables_by_service()
    top_tags = client.get_tag_counts()

    return {
        "totals": {
            "tables": tables,
            "dashboards": dashboards,
            "pipelines": pipelines,
            "topics": topics,
        },
        "tables_by_service": tables_by_service,
        "asset_distribution": [
            {"name": "Tables", "value": tables, "color": "#2563eb"},
            {"name": "Dashboards", "value": dashboards, "color": "#22c55e"},
            {"name": "Pipelines", "value": pipelines, "color": "#f59e0b"},
            {"name": "Topics", "value": topics, "color": "#8b5cf6"},
        ],
        "top_tags": top_tags,
    }

# --------------------------------------------------------- explorer endpoints
@app.get("/explorer/databases")
def explorer_databases():
    """List database services with table counts."""
    client = _get_om_client()
    try:
        svc_data = client._get(
            "/api/v1/services/databaseServices", params={"limit": 20}
        )
    except Exception:
        return []

    results = []
    for svc in svc_data.get("data", []):
        name = svc.get("name", "unknown")
        display = svc.get("displayName") or name
        svc_type = svc.get("serviceType", "Unknown")
        count = 0
        try:
            tbl = client._get("/api/v1/tables", params={"databaseService": name, "limit": 1})
            count = tbl.get("paging", {}).get("total", 0)
        except Exception:
            pass
        results.append({
            "name": name,
            "displayName": display,
            "serviceType": svc_type,
            "tableCount": count,
        })
    results.sort(key=lambda x: x["tableCount"], reverse=True)
    return results


@app.get("/explorer/tables")
def explorer_tables(service: str):
    """List tables for a given database service with column counts and PII flags."""
    client = _get_om_client()
    try:
        data = client._get(
            "/api/v1/tables",
            params={"databaseService": service, "limit": 50, "fields": "columns,tags"},
        )
    except Exception:
        return []

    results = []
    for t in data.get("data", []):
        cols = t.get("columns", [])
        tags = t.get("tags", [])
        has_pii = any("PII" in (tag.get("tagFQN", "") or "") for tag in tags)
        # Also check column-level tags
        if not has_pii:
            for c in cols:
                col_tags = c.get("tags", [])
                if any("PII" in (ct.get("tagFQN", "") or "") for ct in col_tags):
                    has_pii = True
                    break
        results.append({
            "name": t.get("name"),
            "fqn": t.get("fullyQualifiedName"),
            "description": t.get("description", ""),
            "columnCount": len(cols),
            "hasPII": has_pii,
        })
    return results


@app.get("/explorer/columns")
def explorer_columns(tables: list[str] = fastapi.Query(...)):
    """Get columns for one or more tables by FQN."""
    client = _get_om_client()
    results = []
    for fqn in tables:
        try:
            data = client._get(
                f"/api/v1/tables/name/{fqn}",
                params={"fields": "columns,tags"},
            )
        except Exception:
            continue
        columns = []
        for c in data.get("columns", []):
            col_tags = c.get("tags", [])
            is_pii = any("PII" in (ct.get("tagFQN", "") or "") for ct in col_tags)
            constraint = c.get("constraint", "")
            is_pk = constraint == "PRIMARY_KEY"
            columns.append({
                "name": c.get("name"),
                "dataType": c.get("dataType", "UNKNOWN"),
                "description": c.get("description", ""),
                "isPII": is_pii,
                "isPrimaryKey": is_pk,
            })
        results.append({
            "tableName": data.get("name"),
            "tableFqn": data.get("fullyQualifiedName"),
            "columns": columns,
        })
    return results


@app.get("/explorer/quality")
def explorer_quality(table: str):
    """Get data quality test results for a table."""
    client = _get_om_client()
    table_name = table.rsplit(".", 1)[-1] if "." in table else table

    # Try fetching test cases via entityLink
    encoded = table.replace('"', "%22")
    entity_link = f"<#E::table::{encoded}>"
    tests = []
    try:
        data = client._get(
            "/api/v1/dataQuality/testCases",
            params={"entityLink": entity_link, "limit": 20},
        )
        for tc in data.get("data", []):
            result = tc.get("testCaseResult", {})
            status = result.get("testCaseStatus", "UNKNOWN")
            col_name = ""
            param_vals = tc.get("parameterValues", [])
            if param_vals:
                col_name = param_vals[0].get("value", "") if param_vals else ""
            # Try to get column from entityLink
            tc_link = tc.get("entityLink", "")
            if "::columns::" in tc_link:
                col_name = tc_link.split("::columns::")[-1].rstrip(">")
            tests.append({
                "name": tc.get("name", "N/A"),
                "status": status,
                "column": col_name,
            })
    except Exception:
        pass

    # Also try fetching from table's testSuite field
    if not tests:
        try:
            tbl_data = client._get(
                f"/api/v1/tables/name/{table}",
                params={"fields": "testSuite"},
            )
            test_suite = tbl_data.get("testSuite")
            if test_suite and test_suite.get("id"):
                suite_id = test_suite["id"]
                suite_data = client._get(
                    f"/api/v1/dataQuality/testSuites/{suite_id}",
                    params={"fields": "tests"},
                )
                for tc in suite_data.get("tests", []):
                    tests.append({
                        "name": tc.get("name", "N/A"),
                        "status": "UNKNOWN",
                        "column": "",
                    })
        except Exception:
            pass

    if not tests:
        return {
            "tableName": table_name,
            "total": 0,
            "passed": 0,
            "failed": 0,
            "score": None,
            "tests": [],
        }

    passed = sum(1 for t in tests if t["status"] in ("Success", "PASSED"))
    failed = sum(1 for t in tests if t["status"] in ("Failed", "FAILED"))
    total = len(tests)
    score = round((passed / total) * 100) if total > 0 else None

    return {
        "tableName": table_name,
        "total": total,
        "passed": passed,
        "failed": failed,
        "score": score,
        "tests": tests[:5],
    }
