"""LangChain agent for DataChat — routes natural language to OpenMetadata tools."""

import json
import logging
import os

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from openmetadata_client import OpenMetadataClient

load_dotenv()
logger = logging.getLogger("datachat.agent")

MAX_TOOL_RESPONSE = 2000  # chars — keeps tool output within token budget

# ---------------------------------------------------------------- client
_client: OpenMetadataClient | None = None


def _get_client() -> OpenMetadataClient:
    global _client
    if _client is None:
        _client = OpenMetadataClient(
            host=os.getenv("OPENMETADATA_HOST", "http://localhost:8585"),
            username=os.getenv("OPENMETADATA_USERNAME", "admin@open-metadata.org"),
            password=os.getenv("OPENMETADATA_PASSWORD", "admin"),
        )
    return _client


def _truncate(text: str) -> str:
    """Truncate tool output to stay within token limits."""
    if len(text) <= MAX_TOOL_RESPONSE:
        return text
    return text[:MAX_TOOL_RESPONSE] + "\n\n... (truncated for brevity)"


# --------------------------------------------------------------- tools
@tool
def search_data_assets(query: str) -> str:
    """Search for data assets (tables, topics, dashboards, etc.) by keyword.
    Returns name, type, and fullyQualifiedName (FQN) for each result.
    Use the FQN when calling other tools like get_table_details or get_data_lineage."""
    try:
        results = _get_client().search_assets(query)
        if not results:
            return "No data assets found matching your query."
        # Compact format to save tokens
        lines = []
        for r in results:
            lines.append(f"- {r['name']} (type: {r['type']}, fqn: {r['fullyQualifiedName']})")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("search_data_assets failed")
        return f"Error searching assets: {exc}"


@tool
def get_table_details(fqn: str) -> str:
    """Get details of a table including columns, owner, tags, and description.
    IMPORTANT: The fqn must be a fully qualified name like 'sample_data.ecommerce_db.shopify.dim_address'.
    If you only have a short name like 'dim_address', first use search_data_assets to find the FQN."""
    try:
        result = _get_client().get_table_details(fqn)
        # Compact column list to save tokens
        col_lines = []
        for c in result.get("columns", [])[:20]:  # cap at 20 columns
            col_lines.append(f"  - {c['name']} ({c['dataType']})")
        col_str = "\n".join(col_lines)
        total_cols = len(result.get("columns", []))
        extra = f"\n  ... and {total_cols - 20} more columns" if total_cols > 20 else ""
        tags_str = ", ".join(result.get("tags", [])) or "none"
        return (
            f"Table: {result['name']}\n"
            f"FQN: {result['fullyQualifiedName']}\n"
            f"Description: {result.get('description', 'N/A')}\n"
            f"Owner: {result.get('owner', 'N/A')}\n"
            f"Tags: {tags_str}\n"
            f"Columns ({total_cols}):\n{col_str}{extra}"
        )
    except Exception as exc:
        logger.exception("get_table_details failed")
        return f"Error fetching table details: {exc}"


@tool
def get_data_lineage(fqn: str) -> str:
    """Get upstream and downstream lineage for a table.
    IMPORTANT: The fqn must be a fully qualified name like 'sample_data.ecommerce_db.shopify.dim_address'.
    If you only have a short name, first use search_data_assets to find the FQN."""
    try:
        result = _get_client().get_lineage(fqn, entity_type="table")
        lines = [f"Lineage for: {result['entity']}\n"]
        lines.append("UPSTREAM (where this data comes from):")
        for node in result["upstream"]:
            if isinstance(node, dict):
                lines.append(f"  → {node['fullyQualifiedName']} (type: {node['type']}, service: {node['service']})")
            else:
                lines.append(f"  → {node}")
        lines.append("\nDOWNSTREAM (what depends on this data):")
        for node in result["downstream"]:
            if isinstance(node, dict):
                lines.append(f"  → {node['fullyQualifiedName']} (type: {node['type']}, service: {node['service']})")
            else:
                lines.append(f"  → {node}")
        lines.append(f"\nTotal: {result['totalUpstream']} upstream, {result['totalDownstream']} downstream nodes")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("get_data_lineage failed")
        return f"Error fetching lineage: {exc}"


@tool
def get_data_quality(table_fqn: str) -> str:
    """Get data quality test results for a table.
    IMPORTANT: Requires the fully qualified name."""
    try:
        results = _get_client().get_data_quality(table_fqn)
        if not results:
            return f"No data quality tests configured for {table_fqn}"
        lines = [f"Data Quality Tests for {table_fqn}:\n"]
        for tc in results:
            last_run = tc.get("lastRun", "N/A")
            if isinstance(last_run, (int, float)):
                from datetime import datetime, timezone
                last_run = datetime.fromtimestamp(last_run / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
            lines.append(f"  - {tc['name']}: {tc['status']} (last run: {last_run})")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("get_data_quality failed")
        return f"Error fetching data quality: {exc}"


@tool
def list_all_tables() -> str:
    """List available tables in the data catalog (returns up to 10)."""
    try:
        results = _get_client().get_all_tables(limit=10)
        if not results:
            return "No tables found in the catalog."
        lines = []
        for t in results:
            lines.append(f"- {t['name']} (fqn: {t['fullyQualifiedName']}, owner: {t.get('owner', 'N/A')})")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("list_all_tables failed")
        return f"Error listing tables: {exc}"


@tool
def find_pii_data() -> str:
    """Find data assets that are tagged with PII (Personally Identifiable Information)."""
    try:
        results = _get_client().search_pii_data()
        if not results:
            return "No PII-tagged assets found."
        lines = []
        for r in results:
            lines.append(f"- {r['name']} (type: {r['type']}, fqn: {r['fullyQualifiedName']})")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("find_pii_data failed")
        return f"Error searching PII data: {exc}"


@tool
def list_dashboards() -> str:
    """List all dashboards available in the data catalog."""
    try:
        results = _get_client().get_dashboards(limit=10)
        if not results:
            return "No dashboards found in the catalog."
        lines = []
        for d in results:
            lines.append(f"- {d['name']} (fqn: {d['fullyQualifiedName']}, owner: {d.get('owner', 'N/A')})")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("list_dashboards failed")
        return f"Error listing dashboards: {exc}"


@tool
def search_glossary(query: str) -> str:
    """Search the data glossary for business term definitions.
    Use this when users ask about the meaning of data terms, business definitions,
    or governance policies. Example: 'What does churn rate mean?'"""
    try:
        results = _get_client().search_glossary(query)
        if not results:
            # Fallback: list all glossary terms
            results = _get_client().get_glossary_terms(limit=10)
            if not results:
                return "No glossary terms found in the catalog."
            lines = ["Available glossary terms:"]
            for t in results:
                lines.append(f"- **{t['name']}** ({t['glossary']}): {t['description'][:100]}")
            return "\n".join(lines)
        lines = [f"Glossary results for '{query}':\n"]
        for t in results:
            tags_str = ", ".join(t.get("tags", [])) if t.get("tags") else "none"
            lines.append(f"- **{t['name']}** (glossary: {t['glossary']})")
            lines.append(f"  Definition: {t['description'][:200]}")
            lines.append(f"  Tags: {tags_str}")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("search_glossary failed")
        return f"Error searching glossary: {exc}"


@tool
def get_table_profile(fqn: str) -> str:
    """Get data profiler statistics for a table — row count, column count, and last profiled date.
    IMPORTANT: Requires the fully qualified name.
    Use this for data observability questions like 'How many rows does this table have?'
    or 'When was this table last profiled?'"""
    try:
        profile = _get_client().get_table_profile(fqn)
        if not profile:
            return f"No profiler data available for {fqn}. The table may not have been profiled yet."
        lines = [f"Profiler Stats for {fqn}:\n"]
        if profile.get("rowCount") is not None:
            lines.append(f"  - Row count: {profile['rowCount']:,}")
        if profile.get("columnCount") is not None:
            lines.append(f"  - Column count: {profile['columnCount']}")
        if profile.get("timestamp"):
            from datetime import datetime, timezone
            ts = profile["timestamp"]
            if isinstance(ts, (int, float)):
                dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            else:
                dt = str(ts)
            lines.append(f"  - Last profiled: {dt}")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("get_table_profile failed")
        return f"Error fetching table profile: {exc}"


@tool
def find_stale_tables(days: int = 7) -> str:
    """Find tables that haven't been updated or profiled recently.
    Use this for data freshness and observability questions like
    'Which tables are stale?' or 'What data hasn't been updated recently?'
    The days parameter controls how many days back to check (default: 7)."""
    try:
        results = _get_client().get_stale_tables(days=days, limit=20)
        if not results:
            return f"All tables appear to be fresh (profiled within the last {days} days), or no profiler data is available."
        lines = [f"Tables not profiled in the last {days} days:\n"]
        for t in results:
            status = "⚠️ Never profiled" if t["lastProfiled"] == "Never" else f"Last profiled: {t['lastProfiled']}"
            lines.append(f"- {t['name']} (owner: {t['owner']}) — {status}")
        return "\n".join(lines)
    except Exception as exc:
        logger.exception("find_stale_tables failed")
        return f"Error checking stale tables: {exc}"


# ------------------------------------------------------------ agent setup
SYSTEM_PROMPT = (
    "You are DataChat, an intelligent data catalog assistant powered by OpenMetadata. "
    "You help users discover, understand, and explore their organization's data assets "
    "using natural language.\n\n"
    "CRITICAL RULES:\n"
    "- Tools like get_table_details, get_data_lineage, get_data_quality, get_table_profile "
    "require a fully qualified name (FQN) like 'sample_data.ecommerce_db.shopify.dim_address'. "
    "If the user gives only a short name like 'dim_address', FIRST call search_data_assets "
    "to find the FQN, then use that FQN in subsequent tool calls.\n"
    "- If a tool returns empty results or 'No ... found', report that immediately. "
    "Do NOT retry the same tool.\n"
    "- NEVER call the same tool more than once with the same arguments.\n"
    "- Present results in clean markdown format.\n"
    "- Be concise but informative.\n"
    "- For lineage, explain upstream (data sources) and downstream (dependents) clearly.\n"
    "- For glossary questions about business terms or definitions, use search_glossary.\n"
    "- For data freshness or observability questions, use find_stale_tables or get_table_profile.\n"
    "- For data quality questions, use get_data_quality."
)

TOOLS = [
    search_data_assets,
    get_table_details,
    get_data_lineage,
    get_data_quality,
    get_table_profile,
    find_stale_tables,
    search_glossary,
    list_all_tables,
    find_pii_data,
    list_dashboards,
]


def _build_agent():
    """Create the LangGraph ReAct agent."""
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key.startswith("gsk_xxxx"):
        raise ValueError(
            "Please set a real Groq API key in .env "
            "(get one at https://console.groq.com)."
        )

    llm = ChatGroq(
        model="qwen/qwen3-32b",
        temperature=0,
        api_key=api_key,
        max_tokens=2048,
    )
    agent = create_react_agent(llm, TOOLS, prompt=SYSTEM_PROMPT)
    return agent


# --------------------------------------------------------- conversation store
_conversations: dict[str, list] = {}


def get_history(conversation_id: str) -> list:
    return _conversations.setdefault(conversation_id, [])


async def ask_agent(message: str, conversation_id: str) -> str:
    """Send a user message to the agent and return the final text response."""
    logger.info("User [%s]: %s", conversation_id, message)

    agent = _build_agent()
    history = get_history(conversation_id)

    # Keep only the last 4 messages (2 exchanges) to stay within token limits
    recent_history = history[-4:] if len(history) > 4 else history

    # Build message list: system + trimmed history + new user message
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    messages.extend(recent_history)
    messages.append(HumanMessage(content=message))

    result = await agent.ainvoke(
        {"messages": messages},
        config={"recursion_limit": 8},
    )

    # Extract the final AI message
    response_messages = result.get("messages", [])
    ai_text = ""
    for msg in reversed(response_messages):
        if isinstance(msg, AIMessage) and msg.content:
            ai_text = msg.content
            break

    if not ai_text:
        ai_text = "I wasn't able to generate a response. Please try again."

    # Store only the user message and final AI response (not tool calls)
    history.append(HumanMessage(content=message))
    history.append(AIMessage(content=ai_text))
    # Keep max 8 messages in history
    if len(history) > 8:
        del history[:-8]

    logger.info("Agent [%s]: %s", conversation_id, ai_text[:200])
    return ai_text
