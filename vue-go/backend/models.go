package main

import "time"

type Workspace struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type WorkspaceSummary struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Calls       int    `json:"calls"`
	TokensIn    int    `json:"tokens_in"`
	TokensOut   int    `json:"tokens_out"`
}

type PromptTemplate struct {
	ID          int       `json:"id"`
	WorkspaceID int       `json:"workspace_id"`
	Name        string    `json:"name"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}

type LLMCall struct {
	ID            int64     `json:"id"`
	WorkspaceID   int       `json:"workspace_id"`
	WorkspaceName string    `json:"workspace_name,omitempty"`
	TemplateID    *int      `json:"template_id"`
	TemplateName  *string   `json:"template_name,omitempty"`
	Model         string    `json:"model"`
	Prompt        string    `json:"prompt"`
	Response      string    `json:"response"`
	TokensIn      int       `json:"tokens_in"`
	TokensOut     int       `json:"tokens_out"`
	LatencyMs     int       `json:"latency_ms"`
	Temperature   *float64  `json:"temperature"`
	CreatedAt     time.Time `json:"created_at"`
}

type WorkspaceDetail struct {
	ID          int              `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Templates   []PromptTemplate `json:"templates"`
	RecentCalls []LLMCall        `json:"recent_calls"`
}

type ModelPricing struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
}

type Model struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	ContextLength int          `json:"context_length"`
	Pricing       ModelPricing `json:"pricing"`
}

type ByModel struct {
	Model  string `json:"model"`
	Calls  int    `json:"calls"`
	Tokens int    `json:"tokens"`
}

type ByWorkspace struct {
	WorkspaceID int    `json:"workspace_id"`
	Name        string `json:"name"`
	Calls       int    `json:"calls"`
	Tokens      int    `json:"tokens"`
}

type UsageSummary struct {
	TotalCalls     int           `json:"total_calls"`
	TotalTokensIn  int           `json:"total_tokens_in"`
	TotalTokensOut int           `json:"total_tokens_out"`
	ByModel        []ByModel     `json:"by_model"`
	ByWorkspace    []ByWorkspace `json:"by_workspace"`
}

type ChatRunRequest struct {
	WorkspaceID int      `json:"workspace_id"`
	TemplateID  *int     `json:"template_id,omitempty"`
	Model       string   `json:"model"`
	Prompt      string   `json:"prompt"`
	Temperature *float64 `json:"temperature,omitempty"`
}

type ChatRunResponse struct {
	ID        int64  `json:"id"`
	Response  string `json:"response"`
	TokensIn  int    `json:"tokens_in"`
	TokensOut int    `json:"tokens_out"`
	LatencyMs int    `json:"latency_ms"`
	Model     string `json:"model"`
}
