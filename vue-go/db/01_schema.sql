CREATE TABLE workspaces (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_templates (
  id            SERIAL PRIMARY KEY,
  workspace_id  INT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llm_calls (
  id            BIGSERIAL PRIMARY KEY,
  workspace_id  INT  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id   INT  REFERENCES prompt_templates(id) ON DELETE SET NULL,
  model         TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  response      TEXT NOT NULL,
  tokens_in     INT  NOT NULL,
  tokens_out    INT  NOT NULL,
  latency_ms    INT  NOT NULL,
  temperature   REAL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_calls_workspace_idx ON llm_calls (workspace_id, created_at DESC);
CREATE INDEX llm_calls_model_idx     ON llm_calls (model);
