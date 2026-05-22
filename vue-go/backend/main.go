package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
	ctx := context.Background()

	dsn := envOrDefault("DATABASE_URL", "postgres://promptyard:promptyard@db:5432/promptyard?sslmode=disable")
	port := envOrDefault("PORT", "3001")
	apiKey := os.Getenv("OPENROUTER_API_KEY")

	fmt.Printf("Starting %s on :%s, OTEL endpoint: %s\n",
		envOrDefault("OTEL_SERVICE_NAME", "(unset)"),
		port,
		envOrDefault("OTEL_EXPORTER_OTLP_ENDPOINT", "(unset)"))

	shutdownOTel, err := setupOTel(ctx)
	if err != nil {
		log.Fatalf("setup otel: %v", err)
	}

	pool, err := newDBPool(ctx, dsn)
	if err != nil {
		log.Fatalf("setup db: %v", err)
	}

	or := NewOpenRouterClient(apiKey)
	if !or.HasKey() {
		log.Println("warning: OPENROUTER_API_KEY not set; /api/models will be empty and /api/chat/run will return 503")
	} else {
		fetchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		if _, err := or.ListModels(fetchCtx); err != nil {
			log.Printf("warning: failed to fetch models at startup: %v", err)
		}
		cancel()
	}

	srv, err := NewServer(pool, or)
	if err != nil {
		log.Fatalf("setup server: %v", err)
	}

	mux := http.NewServeMux()
	srv.Register(mux)

	handler := withCORS(otelhttp.NewHandler(mux, "http.server"))

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	shutdownCh := make(chan os.Signal, 1)
	signal.Notify(shutdownCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		fmt.Printf("Server listening on :%s\n", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	<-shutdownCh
	fmt.Println("\nShutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown: %v", err)
	}
	if err := shutdownOTel(shutdownCtx); err != nil {
		log.Printf("otel shutdown: %v", err)
	}
	pool.Close()

	fmt.Println("Shutdown complete")
}

func envOrDefault(key, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, traceparent, tracestate")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
