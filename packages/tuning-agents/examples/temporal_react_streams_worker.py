import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from tuning_agents.temporal_react_streams import (
    create_tuning_engines_react_streams_plugin,
    define_temporal_react_streams_workflow,
)


async def main() -> None:
    plugin = create_tuning_engines_react_streams_plugin(include_workflow=False)
    temporal = await Client.connect("localhost:7233", plugins=[plugin])
    workflow = define_temporal_react_streams_workflow()
    worker = Worker(
        temporal,
        task_queue="tuning-react-streams",
        workflows=[workflow],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
