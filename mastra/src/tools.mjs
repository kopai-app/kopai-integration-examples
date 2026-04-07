import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "get-weather",
  description:
    "Fetches current weather conditions for a given city using wttr.in",
  inputSchema: z.object({
    city: z.string().describe("City name to get weather for"),
  }),
  outputSchema: z.object({
    city: z.string(),
    conditions: z.string(),
  }),
  execute: async ({ city }) => {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t`,
    );
    const conditions = await response.text();
    return { city, conditions: conditions.trim() };
  },
});

export const calculatorTool = createTool({
  id: "calculator",
  description:
    "Evaluates a simple arithmetic expression (add, subtract, multiply, divide)",
  inputSchema: z.object({
    a: z.number().describe("First operand"),
    b: z.number().describe("Second operand"),
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("Arithmetic operation"),
  }),
  outputSchema: z.object({
    result: z.number(),
    expression: z.string(),
  }),
  execute: async ({ a, b, operation }) => {
    const ops = {
      add: { fn: (x, y) => x + y, sym: "+" },
      subtract: { fn: (x, y) => x - y, sym: "-" },
      multiply: { fn: (x, y) => x * y, sym: "*" },
      divide: { fn: (x, y) => x / y, sym: "/" },
    };
    const { fn, sym } = ops[operation];
    return { result: fn(a, b), expression: `${a} ${sym} ${b} = ${fn(a, b)}` };
  },
});
