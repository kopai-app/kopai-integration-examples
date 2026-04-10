# LangChain Integration

Interactive chat agent with LangSmith's OpenTelemetry integration sending traces to a local collector.

**Documentation:** [Trace with OpenTelemetry (LangSmith)](https://docs.langchain.com/langsmith/trace-with-opentelemetry)

## Prerequisites

- Python 3.11+
- Kopai account ([sign up](https://kopai.app))

## Setup

1. Start the local collector:
   ```bash
   npx @kopai/app start
   ```

2. Install dependencies:

   **With Nix** (auto-creates venv and installs deps):
   ```bash
   cd langchain
   nix develop
   ```

   **Without Nix:**
   ```bash
   cd langchain
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Run with FakeListChatModel (no API key needed):
   ```bash
   python app.py
   ```
   This starts a REPL chat loop. Send messages and type `exit` to quit.

### Using Real OpenAI

```bash
export OPENAI_API_KEY=sk-...
python app.py
```

## Validate

```bash
npx @kopai/cli traces search
```

## Files

- `app.py` - Interactive chat agent with OTel SDK and LangSmith OTel integration
- `requirements.txt` - Python dependencies

## Learn More

- [LangSmith OTel Docs](https://docs.langchain.com/langsmith/trace-with-opentelemetry) - LangSmith OpenTelemetry integration
- [Sending Traces](https://docs.kopai.app/sending-traces) - OTLP endpoints and configuration
