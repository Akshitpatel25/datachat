"""Quick smoke-test for the DataChat backend."""

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

from openmetadata_client import OpenMetadataClient

DIVIDER = "=" * 60


def test_connection() -> bool:
    """Verify OpenMetadata is reachable."""
    print(f"\n{DIVIDER}")
    print("1. Testing OpenMetadata connection …")
    print(DIVIDER)
    client = OpenMetadataClient(
        host=os.getenv("OPENMETADATA_HOST", "http://localhost:8585"),
        username=os.getenv("OPENMETADATA_USERNAME", "admin@open-metadata.org"),
        password=os.getenv("OPENMETADATA_PASSWORD", "admin"),
    )
    ok = client.check_connection()
    if ok:
        print("✅  OpenMetadata is connected and authenticated!")
    else:
        print("❌  Could not connect to OpenMetadata.")
    return ok


async def test_agent_questions():
    """Ask a few questions through the agent."""
    from agent import ask_agent

    questions = [
        "What tables are available?",
        "Find any PII data",
        "Show me available dashboards",
    ]
    for i, q in enumerate(questions, start=2):
        print(f"\n{DIVIDER}")
        print(f"{i}. Question: {q}")
        print(DIVIDER)
        try:
            answer = await ask_agent(q, conversation_id="test-session")
            print(answer)
        except ValueError as exc:
            print(f"⚠️  {exc}")
        except Exception as exc:
            print(f"❌  Error: {exc}")


def main():
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(name)-28s  %(levelname)-5s  %(message)s",
    )

    print("\n🚀  DataChat Backend Test Suite")
    print(f"{'=' * 60}\n")

    if not test_connection():
        print("\nAborting — OpenMetadata must be running first.")
        sys.exit(1)

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key.startswith("gsk_xxxx"):
        print(
            "\n⚠️  GROQ_API_KEY is a placeholder — skipping agent questions."
        )
        print("   Set a real key in backend/.env (https://console.groq.com).")
        sys.exit(0)

    asyncio.run(test_agent_questions())
    print(f"\n{DIVIDER}")
    print("✅  All tests complete!")
    print(DIVIDER)


if __name__ == "__main__":
    main()
