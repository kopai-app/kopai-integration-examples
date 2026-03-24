import logging
import os
import time

# Suppress noisy LangSmith warnings (e.g. "Run compression is not enabled")
logging.getLogger("langsmith.client").setLevel(logging.ERROR)

# Enable LangSmith OpenTelemetry integration (export only, no LangSmith backend)
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_OTEL_ENABLED"] = "true"
os.environ["LANGSMITH_OTEL_ONLY"] = "true"
os.environ.setdefault("LANGSMITH_API_KEY", "dummy")

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource

from langchain_core.messages import SystemMessage

# OTel SDK setup: send spans to local collector
resource = Resource.create({"service.name": "langchain-example"})
provider = TracerProvider(resource=resource)
exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
provider.add_span_processor(SimpleSpanProcessor(exporter))
trace.set_tracer_provider(provider)

# Use real OpenAI if key is set, otherwise fake chat model
if os.getenv("OPENAI_API_KEY"):
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(model="gpt-4o-mini")
    print("Using ChatOpenAI (gpt-4o-mini)")
else:
    from langchain_community.chat_models.fake import FakeListChatModel

    llm = FakeListChatModel(
        responses=[
            "OpenTelemetry was originally created by merging OpenTracing and OpenCensus in 2019!",
            "The CNCF currently hosts over 170 projects, with Kubernetes being the most well-known.",
            "Distributed tracing was pioneered by Google's Dapper paper published in 2010.",
            "The W3C Trace Context standard ensures traces propagate across service boundaries.",
            "LangChain supports over 70 LLM providers through its unified interface.",
        ]
    )
    print("Using FakeListChatModel (set OPENAI_API_KEY for real responses)")

from langchain_community.chat_message_histories import ChatMessageHistory

history = ChatMessageHistory()
system_message = SystemMessage(content="You are a helpful assistant.")

print('Chat started. Type "exit" or "quit" to stop.\n')

try:
    while True:
        user_input = input("You: ").strip()
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            break

        history.add_user_message(user_input)
        messages = [system_message] + history.messages
        response = llm.invoke(messages)
        history.add_ai_message(response.content)
        print(f"Assistant: {response.content}\n")
except (KeyboardInterrupt, EOFError):
    print()

# Flush spans and shutdown
time.sleep(2)
provider.force_flush()
provider.shutdown()
print("Spans exported. Check with: npx @kopai/cli traces search")
