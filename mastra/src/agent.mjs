import { Agent } from "@mastra/core/agent";
import { weatherTool, calculatorTool } from "./tools.mjs";

export const assistantAgent = new Agent({
  name: "kopai-assistant",
  instructions: `You are a helpful assistant that can check weather and do calculations.
When asked about weather, use the get-weather tool.
When asked to calculate something, use the calculator tool.
Always provide clear, concise answers.`,
  model: "anthropic/claude-haiku-4-5-20251001",
  tools: { weatherTool, calculatorTool },
});
