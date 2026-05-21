-- Workspaces
INSERT INTO workspaces (id, name, description) VALUES
  (1, 'Marketing Team',     'Campaign drafts, social posts, and press releases.'),
  (2, 'Customer Support',   'Ticket triage and reply generation for the support inbox.'),
  (3, 'Engineering Tools',  'Code review, commit summaries, and runbook lookups.');
SELECT setval('workspaces_id_seq', (SELECT MAX(id) FROM workspaces));

-- Prompt templates (3 per workspace)
INSERT INTO prompt_templates (id, workspace_id, name, body) VALUES
  (1, 1, 'Weekly campaign recap',
   'You are a marketing analyst. Summarize the week''s campaign performance using the metrics below. Keep it under 200 words and call out the top channel.'),
  (2, 1, 'Social post drafter',
   'Draft three variations of a social post (Twitter, LinkedIn, Instagram caption) for the announcement below. Match the brand voice: concise, confident, never salesy.'),
  (3, 1, 'Press release polisher',
   'Rewrite the press release below to tighten the lede, remove jargon, and ensure the first paragraph answers who, what, when, where, why.'),

  (4, 2, 'Ticket triage assistant',
   'Read the support ticket and classify by category (billing, bug, feature_request, abuse, other), severity (P0-P3), and recommended next step.'),
  (5, 2, 'Refund-tone reply',
   'Write a refund decision reply. Tone: empathetic, accountable, no corporate filler. Always offer one concrete next step.'),
  (6, 2, 'FAQ extractor',
   'From the ticket transcript below, extract any questions that look like recurring FAQs and propose a one-sentence canonical answer for each.'),

  (7, 3, 'Code review checklist',
   'Review the diff below. Flag: missing tests, unhandled errors, n+1 queries, security smells, naming inconsistencies. Be terse, no praise.'),
  (8, 3, 'Commit message summarizer',
   'Given the diff, write a conventional-commit message (feat/fix/chore + scope) and a 2-line body explaining the why.'),
  (9, 3, 'On-call runbook query',
   'You are an SRE assistant. Given the alert payload, return the most likely cause, the runbook page to consult, and the first command to run.');
SELECT setval('prompt_templates_id_seq', (SELECT MAX(id) FROM prompt_templates));

-- 60 historical llm_calls, distributed across all 9 templates and 4 models
DO $$
DECLARE
  i INT;
  tpl prompt_templates%ROWTYPE;
  models TEXT[] := ARRAY[
    'anthropic/claude-opus-4.7',
    'openai/gpt-5',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-v3'
  ];
  chosen_model TEXT;
  temp REAL;
BEGIN
  FOR i IN 1..60 LOOP
    SELECT * INTO tpl FROM prompt_templates WHERE id = ((i - 1) % 9) + 1;
    chosen_model := models[((i - 1) % 4) + 1];
    temp := CASE WHEN random() < 0.4 THEN NULL ELSE round((random() * 1.5)::numeric, 2)::REAL END;
    INSERT INTO llm_calls (workspace_id, template_id, model, prompt, response, tokens_in, tokens_out, latency_ms, temperature, created_at)
    VALUES (
      tpl.workspace_id,
      tpl.id,
      chosen_model,
      'Sample prompt for "' || tpl.name || '" — input row ' || i,
      'Generated response for ' || tpl.name || ' using ' || chosen_model || ' (mock historical record).',
      (80 + (random() * 720)::INT),
      (90 + (random() * 510)::INT),
      (400 + (random() * 2100)::INT),
      temp,
      NOW() - (random() * INTERVAL '14 days')
    );
  END LOOP;
END $$;
