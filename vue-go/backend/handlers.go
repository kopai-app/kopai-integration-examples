package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	otellog "go.opentelemetry.io/otel/log"
	"go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

// recordSpanError marks the span as errored with a static, greppable slug.
// The slug is what you'd group/filter by in Kopai to find every occurrence of
// a specific failure site, regardless of the exception message.
func recordSpanError(span trace.Span, slug string, err error) {
	span.SetAttributes(attribute.String("exception.slug", slug))
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

type Server struct {
	db        *pgxpool.Pool
	or        *OpenRouterClient
	tokens    metric.Int64Counter
	requests  metric.Int64Counter
	latency   metric.Float64Histogram
	logger    otellog.Logger
}

func NewServer(db *pgxpool.Pool, or *OpenRouterClient) (*Server, error) {
	// === OTel: custom metric instruments ===
	// Names + descriptions + units land in Kopai's metric catalog, so being
	// descriptive here pays off when querying later. Instruments are created
	// once and reused; do NOT recreate them per request.
	meter := otel.Meter("promptyard-go")
	tokens, err := meter.Int64Counter("llm.tokens.consumed",
		metric.WithDescription("LLM tokens consumed (in + out)"),
		metric.WithUnit("{token}"),
	)
	if err != nil {
		return nil, err
	}
	requests, err := meter.Int64Counter("llm.requests",
		metric.WithDescription("LLM chat requests"),
		metric.WithUnit("{request}"),
	)
	if err != nil {
		return nil, err
	}
	latency, err := meter.Float64Histogram("llm.latency",
		metric.WithDescription("LLM chat latency"),
		metric.WithUnit("ms"),
	)
	if err != nil {
		return nil, err
	}
	return &Server{
		db:       db,
		or:       or,
		tokens:   tokens,
		requests: requests,
		latency:  latency,
		logger:   global.GetLoggerProvider().Logger("promptyard-go"),
	}, nil
}

func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/models", s.handleModels)
	mux.HandleFunc("GET /api/workspaces", s.handleWorkspaces)
	mux.HandleFunc("GET /api/workspaces/{id}", s.handleWorkspaceDetail)
	mux.HandleFunc("GET /api/usage/summary", s.handleUsageSummary)
	mux.HandleFunc("GET /api/activity", s.handleActivity)
	mux.HandleFunc("POST /api/chat/run", s.handleChatRun)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Trace context is propagated to log records automatically by the SDK from the
// ctx passed to Emit, so callers must thread the request ctx (with active span)
// through emitInfo/emitError to get log-trace correlation in Kopai.

func (s *Server) emitInfo(ctx context.Context, body string, attrs ...otellog.KeyValue) {
	rec := otellog.Record{}
	rec.SetTimestamp(time.Now())
	rec.SetSeverity(otellog.SeverityInfo)
	rec.SetSeverityText("INFO")
	rec.SetBody(otellog.StringValue(body))
	rec.AddAttributes(attrs...)
	s.logger.Emit(ctx, rec)
}

func (s *Server) emitError(ctx context.Context, body string, attrs ...otellog.KeyValue) {
	rec := otellog.Record{}
	rec.SetTimestamp(time.Now())
	rec.SetSeverity(otellog.SeverityError)
	rec.SetSeverityText("ERROR")
	rec.SetBody(otellog.StringValue(body))
	rec.AddAttributes(attrs...)
	s.logger.Emit(ctx, rec)
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	_, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.models")
	defer span.End()
	models := s.or.CachedModels()
	span.SetAttributes(
		attribute.Bool("cache.hit", true),
		attribute.Int("openrouter.models.count", len(models)),
	)
	writeJSON(w, http.StatusOK, models)
}

func (s *Server) handleWorkspaces(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.workspaces")
	defer span.End()

	rows, err := s.db.Query(ctx, `
		SELECT w.id, w.name, COALESCE(w.description, ''),
		       COALESCE(c.calls, 0), COALESCE(c.tokens_in, 0), COALESCE(c.tokens_out, 0)
		FROM workspaces w
		LEFT JOIN (
		  SELECT workspace_id,
		         COUNT(*) AS calls,
		         SUM(tokens_in) AS tokens_in,
		         SUM(tokens_out) AS tokens_out
		  FROM llm_calls
		  GROUP BY workspace_id
		) c ON c.workspace_id = w.id
		ORDER BY w.id ASC
	`)
	if err != nil {
		s.emitError(ctx, "db query workspaces failed", otellog.String("error", err.Error()))
		recordSpanError(span, "err-db-query-workspaces", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	out := []WorkspaceSummary{}
	for rows.Next() {
		var ws WorkspaceSummary
		if err := rows.Scan(&ws.ID, &ws.Name, &ws.Description, &ws.Calls, &ws.TokensIn, &ws.TokensOut); err != nil {
			recordSpanError(span, "err-db-scan-workspace", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		out = append(out, ws)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleWorkspaceDetail(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.workspace_detail")
	defer span.End()

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	span.SetAttributes(attribute.String("workspace.id", idStr))

	var ws WorkspaceDetail
	err = s.db.QueryRow(ctx,
		`SELECT id, name, COALESCE(description, '') FROM workspaces WHERE id = $1`, id,
	).Scan(&ws.ID, &ws.Name, &ws.Description)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "workspace not found")
			return
		}
		s.emitError(ctx, "db query workspace failed", otellog.String("error", err.Error()))
		recordSpanError(span, "err-db-query-workspace-detail", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	tRows, err := s.db.Query(ctx,
		`SELECT id, workspace_id, name, body, created_at
		 FROM prompt_templates WHERE workspace_id = $1 ORDER BY id ASC`, id)
	if err != nil {
		recordSpanError(span, "err-db-query-templates", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tRows.Close()
	ws.Templates = []PromptTemplate{}
	for tRows.Next() {
		var t PromptTemplate
		if err := tRows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Body, &t.CreatedAt); err != nil {
			recordSpanError(span, "err-db-scan-template", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		ws.Templates = append(ws.Templates, t)
	}

	cRows, err := s.db.Query(ctx, `
		SELECT lc.id, lc.workspace_id, lc.template_id, pt.name,
		       lc.model, lc.prompt, lc.response,
		       lc.tokens_in, lc.tokens_out, lc.latency_ms, lc.temperature, lc.created_at
		FROM llm_calls lc
		LEFT JOIN prompt_templates pt ON pt.id = lc.template_id
		WHERE lc.workspace_id = $1
		ORDER BY lc.created_at DESC
		LIMIT 20
	`, id)
	if err != nil {
		recordSpanError(span, "err-db-query-recent-calls", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer cRows.Close()
	ws.RecentCalls = []LLMCall{}
	for cRows.Next() {
		var c LLMCall
		if err := cRows.Scan(&c.ID, &c.WorkspaceID, &c.TemplateID, &c.TemplateName,
			&c.Model, &c.Prompt, &c.Response,
			&c.TokensIn, &c.TokensOut, &c.LatencyMs, &c.Temperature, &c.CreatedAt); err != nil {
			recordSpanError(span, "err-db-scan-llm-call", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		ws.RecentCalls = append(ws.RecentCalls, c)
	}

	writeJSON(w, http.StatusOK, ws)
}

func (s *Server) handleUsageSummary(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.usage_summary")
	defer span.End()

	var out UsageSummary
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(COUNT(*),0), COALESCE(SUM(tokens_in),0), COALESCE(SUM(tokens_out),0)
		FROM llm_calls
	`).Scan(&out.TotalCalls, &out.TotalTokensIn, &out.TotalTokensOut)
	if err != nil {
		s.emitError(ctx, "db query usage totals failed", otellog.String("error", err.Error()))
		recordSpanError(span, "err-db-query-usage-totals", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	mRows, err := s.db.Query(ctx, `
		SELECT model, COUNT(*) AS calls, SUM(tokens_in + tokens_out) AS tokens
		FROM llm_calls
		GROUP BY model
		ORDER BY tokens DESC
	`)
	if err != nil {
		recordSpanError(span, "err-db-query-by-model", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer mRows.Close()
	out.ByModel = []ByModel{}
	for mRows.Next() {
		var bm ByModel
		if err := mRows.Scan(&bm.Model, &bm.Calls, &bm.Tokens); err != nil {
			recordSpanError(span, "err-db-scan-by-model", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		out.ByModel = append(out.ByModel, bm)
	}

	wRows, err := s.db.Query(ctx, `
		SELECT w.id, w.name, COUNT(lc.id), COALESCE(SUM(lc.tokens_in + lc.tokens_out), 0)
		FROM workspaces w
		LEFT JOIN llm_calls lc ON lc.workspace_id = w.id
		GROUP BY w.id, w.name
		ORDER BY w.id ASC
	`)
	if err != nil {
		recordSpanError(span, "err-db-query-by-workspace", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer wRows.Close()
	out.ByWorkspace = []ByWorkspace{}
	for wRows.Next() {
		var bw ByWorkspace
		if err := wRows.Scan(&bw.WorkspaceID, &bw.Name, &bw.Calls, &bw.Tokens); err != nil {
			recordSpanError(span, "err-db-scan-by-workspace", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		out.ByWorkspace = append(out.ByWorkspace, bw)
	}

	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.activity")
	defer span.End()

	rows, err := s.db.Query(ctx, `
		SELECT lc.id, lc.workspace_id, w.name, lc.template_id, pt.name,
		       lc.model, lc.prompt, lc.response,
		       lc.tokens_in, lc.tokens_out, lc.latency_ms, lc.temperature, lc.created_at
		FROM llm_calls lc
		JOIN workspaces w ON w.id = lc.workspace_id
		LEFT JOIN prompt_templates pt ON pt.id = lc.template_id
		ORDER BY lc.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		s.emitError(ctx, "db query activity failed", otellog.String("error", err.Error()))
		recordSpanError(span, "err-db-query-activity", err)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()

	out := []LLMCall{}
	for rows.Next() {
		var c LLMCall
		if err := rows.Scan(&c.ID, &c.WorkspaceID, &c.WorkspaceName, &c.TemplateID, &c.TemplateName,
			&c.Model, &c.Prompt, &c.Response,
			&c.TokensIn, &c.TokensOut, &c.LatencyMs, &c.Temperature, &c.CreatedAt); err != nil {
			recordSpanError(span, "err-db-scan-activity", err)
			writeError(w, http.StatusInternalServerError, "scan error")
			return
		}
		out = append(out, c)
	}
	writeJSON(w, http.StatusOK, out)
}

// handleChatRun is the dense OTel showcase. It emits:
//   - one manual span `handler.chat_run` with business + GenAI semconv attrs
//   - histogram `llm.latency` (every call), counter `llm.requests`
//     (status=ok|error), counter `llm.tokens.consumed` (on ok)
//   - one INFO log on success, one ERROR log on each failure mode
//
// All on the same ctx so Kopai correlates them by trace ID and by the
// shared attribute keys (gen_ai.request.model, workspace.id).
func (s *Server) handleChatRun(w http.ResponseWriter, r *http.Request) {
	// === OTel span: handler.chat_run ===
	ctx, span := otel.Tracer("promptyard-go").Start(r.Context(), "handler.chat_run")
	defer span.End()

	var req ChatRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		recordSpanError(span, "err-chat-run-decode-body", err)
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	// workspace.id is a string so the same dimension key works for both
	// browser-side and Go-side metrics/spans in Kopai.
	workspaceID := strconv.Itoa(req.WorkspaceID)

	// Business + GenAI semconv attributes on the parent span. Kopai will
	// aggregate these dimensions; matching keys across spans + metrics + logs
	// is what makes the wide-event query work.
	span.SetAttributes(
		attribute.String("workspace.id", workspaceID),
		attribute.String("gen_ai.system", "openrouter"),
		attribute.String("gen_ai.request.model", req.Model),
	)

	if !s.or.HasKey() {
		span.SetAttributes(attribute.String("exception.slug", "err-openrouter-key-missing"))
		writeError(w, http.StatusServiceUnavailable, "OPENROUTER_API_KEY not configured")
		return
	}

	orStart := time.Now()
	response, tokensIn, tokensOut, err := s.or.Chat(ctx, req.Model, req.Prompt, req.Temperature)
	orDurationMs := time.Since(orStart).Milliseconds()
	span.SetAttributes(attribute.Int64("openrouter.duration_ms", orDurationMs))

	baseAttrs := []attribute.KeyValue{
		attribute.String("gen_ai.request.model", req.Model),
		attribute.String("workspace.id", workspaceID),
	}
	statusAttrs := func(status string) metric.MeasurementOption {
		return metric.WithAttributes(append(baseAttrs, attribute.String("status", status))...)
	}
	// === OTel metric: llm.latency (recorded for every call, ok or error) ===
	// Same dimensions as llm.requests so Kopai can slice both on the same axes.
	s.latency.Record(ctx, float64(orDurationMs), metric.WithAttributes(baseAttrs...))

	if err != nil {
		s.requests.Add(ctx, 1, statusAttrs("error"))
		s.emitError(ctx, "openrouter chat failed",
			otellog.String("workspace.id", workspaceID),
			otellog.String("gen_ai.request.model", req.Model),
			otellog.String("error", err.Error()),
		)
		recordSpanError(span, "err-openrouter-chat-failed", err)
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	span.SetAttributes(
		attribute.Int("gen_ai.usage.input_tokens", tokensIn),
		attribute.Int("gen_ai.usage.output_tokens", tokensOut),
	)

	dbStart := time.Now()
	var id int64
	dbErr := s.db.QueryRow(ctx, `
		INSERT INTO llm_calls (workspace_id, template_id, model, prompt, response, tokens_in, tokens_out, latency_ms, temperature)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`,
		req.WorkspaceID, req.TemplateID, req.Model, req.Prompt, response,
		tokensIn, tokensOut, int(orDurationMs), req.Temperature,
	).Scan(&id)
	span.SetAttributes(attribute.Int64("db.insert.duration_ms", time.Since(dbStart).Milliseconds()))
	if dbErr != nil {
		s.requests.Add(ctx, 1, statusAttrs("error"))
		s.emitError(ctx, "db insert llm_call failed", otellog.String("error", dbErr.Error()))
		recordSpanError(span, "err-db-insert-llm-call", dbErr)
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	// === OTel metrics + log: success path ===
	s.requests.Add(ctx, 1, statusAttrs("ok"))
	s.tokens.Add(ctx, int64(tokensIn+tokensOut), metric.WithAttributes(baseAttrs...))

	s.emitInfo(ctx, "chat run completed",
		otellog.String("workspace.id", workspaceID),
		otellog.String("gen_ai.request.model", req.Model),
		otellog.Int("gen_ai.usage.input_tokens", tokensIn),
		otellog.Int("gen_ai.usage.output_tokens", tokensOut),
		otellog.Int64("openrouter.duration_ms", orDurationMs),
	)

	writeJSON(w, http.StatusOK, ChatRunResponse{
		ID:        id,
		Response:  response,
		TokensIn:  tokensIn,
		TokensOut: tokensOut,
		LatencyMs: int(orDurationMs),
		Model:     req.Model,
	})
}
