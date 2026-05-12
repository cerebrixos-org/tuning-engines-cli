import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents.temporal import (
    agent_message_activity,
    chat_completion_activity,
    define_temporal_workflow,
    mcp_tool_activity,
)


async def main() -> None:
    temporal = await Client.connect("localhost:7233")
    workflow = define_temporal_workflow()
    worker = Worker(
        temporal,
        task_queue="tuning-agents",
        workflows=[workflow],
        activities=[chat_completion_activity, mcp_tool_activity, agent_message_activity],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
