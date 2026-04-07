import { Mastra } from "@mastra/core";
import { Observability } from "@mastra/observability";
import { OtelExporter } from "@mastra/otel-exporter";
import { assistantAgent } from "./agent.mjs";

const mastra = new Mastra({
  agents: { assistantAgent },
  observability: new Observability({
    configs: {
      kopai: {
        serviceName: "mastra-agent",
        exporters: [
          new OtelExporter({
            provider: {
              custom: {
                endpoint: "http://localhost:4318/v1/traces",
                protocol: "http/json",
              },
            },
          }),
        ],
      },
    },
  }),
});

const agent = mastra.getAgent("assistantAgent");

const prompts = [
  "What's the weather like in Berlin and Tokyo?",
  "Calculate 42 multiplied by 17, then subtract 100 from the result",
  "Compare the weather in London and New York, and tell me the temperature difference if you can estimate it",
];

for (const prompt of prompts) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Prompt: ${prompt}`);
  console.log("=".repeat(60));

  const response = await agent.generate(prompt);
  console.log(`\nResponse:\n${response.text}`);
}

// Give exporters time to flush
await new Promise((resolve) => setTimeout(resolve, 3000));

console.log("\n\nDone! Check your telemetry data:");
console.log("  npx @kopai/cli traces search --service mastra-agent --json");
console.log("  npx @kopai/cli logs search --service mastra-agent --json");
console.log("  npx @kopai/cli metrics discover --json");
