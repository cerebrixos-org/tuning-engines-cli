from langgraph.checkpoint.memory import InMemorySaver

from tuning_agents import TuningClient
from tuning_agents.langgraph import create_tuning_langgraph_agent, invoke_with_trace


client = TuningClient()

agent = create_tuning_langgraph_agent(
    client,
    model="llama-3.3-70b-fp8",
    agent_names=["billing-escalation"],
    checkpointer=InMemorySaver(),
    interrupt_before=["tools"],
)

result = invoke_with_trace(
    client,
    agent,
    [{"role": "user", "content": "List the available governed tools and summarize what you can do."}],
    thread_id="demo-thread",
)

print(result)
print(client.trace.as_dict())
