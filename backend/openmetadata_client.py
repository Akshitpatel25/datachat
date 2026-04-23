"""OpenMetadata REST API client for DataChat."""

import base64
import logging
from typing import Any

import httpx

logger = logging.getLogger("datachat.openmetadata")


class OpenMetadataClient:
    """Wrapper around the OpenMetadata REST API."""

    def __init__(self, host: str, username: str, password: str) -> None:
        self.host = host.rstrip("/")
        self.username = username
        self.password = password
        self._token: str | None = None

    # ------------------------------------------------------------------ auth
    def authenticate(self) -> str:
        """Login with email/password and return a JWT token.

        OpenMetadata requires the password to be Base64-encoded.
        """
        url = f"{self.host}/api/v1/users/login"
        encoded_password = base64.b64encode(self.password.encode()).decode()
        payload = {"email": self.username, "password": encoded_password}
        logger.info("Authenticating with OpenMetadata at %s", url)
        resp = httpx.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        self._token = data.get("accessToken") or data.get("tokenType", "")
        logger.info("Authentication successful")
        return self._token

    @property
    def token(self) -> str:
        if not self._token:
            self.authenticate()
        return self._token

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    def _get(self, path: str, params: dict | None = None) -> Any:
        """Issue an authenticated GET request."""
        url = f"{self.host}{path}"
        logger.info("GET %s  params=%s", url, params)
        resp = httpx.get(url, headers=self._headers, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()

    # -------------------------------------------------------------- search
    def search_assets(self, query: str) -> list[dict]:
        """Search data assets by free-text query."""
        data = self._get(
            "/api/v1/search/query",
            params={"q": query, "index": "dataAsset", "from": 0, "size": 5},
        )
        hits = (
            data.get("hits", {}).get("hits", [])
            if "hits" in data
            else data.get("data", [])
        )
        results: list[dict] = []
        for hit in hits:
            src = hit.get("_source", hit)
            results.append(
                {
                    "name": src.get("name", "N/A"),
                    "type": src.get("entityType", "N/A"),
                    "description": src.get("description", "No description"),
                    "owner": _extract_owner(src),
                    "fullyQualifiedName": src.get("fullyQualifiedName", "N/A"),
                }
            )
        return results

    # --------------------------------------------------------- table details
    def get_table_details(self, fqn: str) -> dict:
        """Get detailed info for a specific table by fully-qualified name."""
        data = self._get(
            f"/api/v1/tables/name/{fqn}",
            params={"fields": "columns,owners,tags,description"},
        )
        columns = [
            {
                "name": c.get("name"),
                "dataType": c.get("dataType"),
                "description": c.get("description", ""),
            }
            for c in data.get("columns", [])
        ]
        return {
            "name": data.get("name"),
            "fullyQualifiedName": data.get("fullyQualifiedName"),
            "description": data.get("description", "No description"),
            "owner": _extract_owner(data),
            "tags": [t.get("tagFQN", str(t)) for t in data.get("tags", [])],
            "columns": columns,
        }

    # -------------------------------------------------------------- lineage
    def get_lineage(self, fqn: str, entity_type: str = "table") -> dict:
        """Get upstream/downstream lineage for an entity with rich detail."""
        data = self._get(
            f"/api/v1/lineage/{entity_type}/name/{fqn}",
            params={"upstreamDepth": 3, "downstreamDepth": 3},
        )
        # Build a lookup: id -> {fqn, type, service}
        node_info: dict[str, dict] = {}
        for n in data.get("nodes", []):
            nid = n.get("id")
            node_info[nid] = {
                "fullyQualifiedName": n.get("fullyQualifiedName", n.get("name", "unknown")),
                "type": n.get("entityType", "unknown"),
                "service": n.get("service", {}).get("name", "unknown") if isinstance(n.get("service"), dict) else "unknown",
            }
        entity_id = data.get("entity", {}).get("id")
        upstream: list[dict] = []
        downstream: list[dict] = []
        for edge in data.get("upstreamEdges", []):
            from_id = edge.get("fromEntity")
            if from_id and from_id != entity_id and from_id in node_info:
                upstream.append(node_info[from_id])
        for edge in data.get("downstreamEdges", []):
            to_id = edge.get("toEntity")
            if to_id and to_id != entity_id and to_id in node_info:
                downstream.append(node_info[to_id])
        return {
            "entity": fqn,
            "upstream": upstream or [{"fullyQualifiedName": "No upstream lineage found", "type": "-", "service": "-"}],
            "downstream": downstream or [{"fullyQualifiedName": "No downstream lineage found", "type": "-", "service": "-"}],
            "totalUpstream": len(upstream),
            "totalDownstream": len(downstream),
        }

    # ----------------------------------------------------------- all tables
    def get_all_tables(self, limit: int = 10) -> list[dict]:
        """List tables from the catalog."""
        data = self._get(
            "/api/v1/tables",
            params={"limit": limit, "fields": "owners,tags,description"},
        )
        results: list[dict] = []
        for t in data.get("data", []):
            results.append(
                {
                    "name": t.get("name"),
                    "fullyQualifiedName": t.get("fullyQualifiedName"),
                    "description": t.get("description", "No description"),
                    "owner": _extract_owner(t),
                }
            )
        return results

    # --------------------------------------------------------------- PII
    def search_pii_data(self) -> list[dict]:
        """Search for assets tagged with PII."""
        data = self._get(
            "/api/v1/search/query",
            params={"q": "PII", "index": "dataAsset", "from": 0, "size": 10},
        )
        hits = (
            data.get("hits", {}).get("hits", [])
            if "hits" in data
            else data.get("data", [])
        )
        results: list[dict] = []
        for hit in hits:
            src = hit.get("_source", hit)
            results.append(
                {
                    "name": src.get("name", "N/A"),
                    "type": src.get("entityType", "N/A"),
                    "description": src.get("description", "No description"),
                    "fullyQualifiedName": src.get("fullyQualifiedName", "N/A"),
                }
            )
        return results

    # ---------------------------------------------------------- dashboards
    def get_dashboards(self, limit: int = 10) -> list[dict]:
        """List dashboards from the catalog."""
        data = self._get(
            "/api/v1/dashboards",
            params={"limit": limit, "fields": "owners,description"},
        )
        results: list[dict] = []
        for d in data.get("data", []):
            results.append(
                {
                    "name": d.get("name"),
                    "fullyQualifiedName": d.get("fullyQualifiedName"),
                    "description": d.get("description", "No description"),
                    "owner": _extract_owner(d),
                }
            )
        return results

    # -------------------------------------------------------- data quality
    def get_data_quality(self, table_fqn: str) -> list[dict]:
        """Get data quality test cases for a table."""
        encoded = table_fqn.replace('"', "%22")
        entity_link = f"<#E::table::{encoded}>"
        data = self._get(
            "/api/v1/dataQuality/testCases",
            params={"entityLink": entity_link, "limit": 10},
        )
        results: list[dict] = []
        for tc in data.get("data", []):
            last_result = tc.get("testCaseResult", {})
            results.append(
                {
                    "name": tc.get("name", "N/A"),
                    "status": last_result.get("testCaseStatus", "UNKNOWN"),
                    "lastRun": last_result.get("timestamp", "N/A"),
                }
            )
        return results

    # ----------------------------------------------------------- stats
    def get_stats(self) -> dict:
        """Get counts of tables, dashboards, pipelines."""
        stats = {}
        for entity in ("tables", "dashboards", "pipelines"):
            try:
                data = self._get(f"/api/v1/{entity}", params={"limit": 1})
                stats[entity] = data.get("paging", {}).get("total", 0)
            except Exception:
                stats[entity] = 0
        return stats

    def get_entity_count(self, entity: str) -> int:
        """Get total count for an entity type."""
        try:
            data = self._get(f"/api/v1/{entity}", params={"limit": 1})
            return data.get("paging", {}).get("total", 0)
        except Exception:
            return 0

    def get_tables_by_service(self) -> list[dict]:
        """Get table counts grouped by database service."""
        try:
            services_data = self._get(
                "/api/v1/services/databaseServices", params={"limit": 20}
            )
        except Exception:
            return []
        results: list[dict] = []
        for svc in services_data.get("data", []):
            name = svc.get("name", "unknown")
            try:
                tbl_data = self._get(
                    "/api/v1/tables",
                    params={"databaseService": name, "limit": 1},
                )
                count = tbl_data.get("paging", {}).get("total", 0)
            except Exception:
                count = 0
            if count > 0:
                results.append({"service": name, "tables": count})
        results.sort(key=lambda x: x["tables"], reverse=True)
        return results[:6]

    def get_tag_counts(self) -> list[dict]:
        """Search for PII-related tags and their usage counts."""
        try:
            data = self._get(
                "/api/v1/search/query",
                params={"q": "PII", "index": "tag", "from": 0, "size": 20},
            )
        except Exception:
            return []
        hits = (
            data.get("hits", {}).get("hits", [])
            if "hits" in data
            else data.get("data", [])
        )
        results: list[dict] = []
        for hit in hits:
            src = hit.get("_source", hit)
            tag_name = src.get("fullyQualifiedName") or src.get("name", "unknown")
            count = src.get("usageCount", src.get("entityCount", 0))
            results.append({"tag": tag_name, "count": count})
        results.sort(key=lambda x: x["count"], reverse=True)
        return results

    # -------------------------------------------------------- health check
    def check_connection(self) -> bool:
        """Return True if OpenMetadata is reachable and auth works."""
        try:
            self._get("/api/v1/system/version")
            return True
        except Exception:
            logger.exception("OpenMetadata connection check failed")
            return False


# ----------------------------------------------------------------- helpers
def _extract_owner(data: dict) -> str:
    """Pull owner display name from various response shapes."""
    owners = data.get("owners") or data.get("owner")
    if isinstance(owners, list) and owners:
        return owners[0].get("displayName") or owners[0].get("name", "N/A")
    if isinstance(owners, dict):
        return owners.get("displayName") or owners.get("name", "N/A")
    return "No owner"
