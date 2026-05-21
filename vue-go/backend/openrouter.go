package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

type OpenRouterClient struct {
	apiKey string
	base   string
	http   *http.Client

	mu     sync.RWMutex
	models []Model
}

func NewOpenRouterClient(apiKey string) *OpenRouterClient {
	return &OpenRouterClient{
		apiKey: apiKey,
		base:   "https://openrouter.ai/api/v1",
		http: &http.Client{
			Timeout:   60 * time.Second,
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		},
	}
}

func (c *OpenRouterClient) HasKey() bool { return c.apiKey != "" }

// CachedModels returns the snapshot fetched at startup. The example never
// refreshes — a real app would re-fetch on a timer or expose an admin trigger.
func (c *OpenRouterClient) CachedModels() []Model {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.models == nil {
		return []Model{}
	}
	out := make([]Model, len(c.models))
	copy(out, c.models)
	return out
}

func (c *OpenRouterClient) ListModels(ctx context.Context) ([]Model, error) {
	tracer := otel.Tracer("promptyard-go")
	ctx, span := tracer.Start(ctx, "openrouter.list_models")
	defer span.End()
	span.SetAttributes(attribute.String("gen_ai.system", "openrouter"))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+"/models", nil)
	if err != nil {
		recordSpanError(span, "err-openrouter-list-build-request", err)
		return nil, err
	}
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		recordSpanError(span, "err-openrouter-list-transport", err)
		return nil, err
	}
	defer resp.Body.Close()
	span.SetAttributes(attribute.Int("http.response.status_code", resp.StatusCode))
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("openrouter models: %s: %s", resp.Status, string(body))
		recordSpanError(span, "err-openrouter-list-http", err)
		return nil, err
	}

	var payload struct {
		Data []Model `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		recordSpanError(span, "err-openrouter-list-decode", err)
		return nil, err
	}

	c.mu.Lock()
	c.models = payload.Data
	c.mu.Unlock()

	span.SetAttributes(attribute.Int("openrouter.models.count", len(payload.Data)))
	return payload.Data, nil
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature *float64      `json:"temperature,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (c *OpenRouterClient) Chat(ctx context.Context, model, prompt string, temperature *float64) (string, int, int, error) {
	tracer := otel.Tracer("promptyard-go")
	ctx, span := tracer.Start(ctx, "openrouter.chat")
	defer span.End()
	span.SetAttributes(
		attribute.String("gen_ai.system", "openrouter"),
		attribute.String("gen_ai.request.model", model),
		attribute.Int("gen_ai.prompt.length", len(prompt)),
	)

	if c.apiKey == "" {
		err := errors.New("OPENROUTER_API_KEY not configured")
		recordSpanError(span, "err-openrouter-key-missing", err)
		return "", 0, 0, err
	}

	body, err := json.Marshal(chatRequest{
		Model:       model,
		Messages:    []chatMessage{{Role: "user", Content: prompt}},
		Temperature: temperature,
	})
	if err != nil {
		recordSpanError(span, "err-openrouter-chat-marshal", err)
		return "", 0, 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		recordSpanError(span, "err-openrouter-chat-build-request", err)
		return "", 0, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		recordSpanError(span, "err-openrouter-chat-transport", err)
		return "", 0, 0, err
	}
	defer resp.Body.Close()
	span.SetAttributes(attribute.Int("http.response.status_code", resp.StatusCode))

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		recordSpanError(span, "err-openrouter-chat-read-body", err)
		return "", 0, 0, err
	}

	if resp.StatusCode >= 400 {
		err := fmt.Errorf("openrouter chat: %s: %s", resp.Status, string(respBytes))
		recordSpanError(span, "err-openrouter-chat-http", err)
		return "", 0, 0, err
	}

	var payload chatResponse
	if err := json.Unmarshal(respBytes, &payload); err != nil {
		recordSpanError(span, "err-openrouter-chat-decode", err)
		return "", 0, 0, err
	}
	if payload.Error != nil {
		err := fmt.Errorf("openrouter chat: %s", payload.Error.Message)
		recordSpanError(span, "err-openrouter-chat-payload-error", err)
		return "", 0, 0, err
	}
	if len(payload.Choices) == 0 {
		err := errors.New("openrouter chat: no choices in response")
		recordSpanError(span, "err-openrouter-chat-no-choices", err)
		return "", 0, 0, err
	}

	content := payload.Choices[0].Message.Content
	tokensIn := payload.Usage.PromptTokens
	tokensOut := payload.Usage.CompletionTokens
	span.SetAttributes(
		attribute.Int("gen_ai.usage.input_tokens", tokensIn),
		attribute.Int("gen_ai.usage.output_tokens", tokensOut),
	)
	return content, tokensIn, tokensOut, nil
}
