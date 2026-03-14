import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hasPrivateKey } from "../config.js";
import { x402Post } from "../client.js";
import { offlineResponse } from "../offline.js";

function authError() {
  return {
    content: [
      {
        type: "text" as const,
        text: "Set DAODEGEN_PRIVATE_KEY to enable authenticated tools",
      },
    ],
    isError: true,
  };
}

export function registerOracleTools(server: McpServer) {
  server.tool(
    "verse_lookup",
    "Get a verse's text and AI interpretation. Costs $0.001 USDC via x402.",
    {
      verse: z
        .number()
        .int()
        .min(1)
        .max(81)
        .describe("Verse number (1-81)"),
    },
    async ({ verse }) => {
      if (!hasPrivateKey()) return authError();

      try {
        const result = await x402Post("/v1/verse/lookup", { verse });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch {
        return offlineResponse("verse_lookup");
      }
    },
  );

  server.tool(
    "verse_commentary",
    "Get contextual AI commentary on a verse. Costs $0.01 USDC via x402.",
    {
      verse: z
        .number()
        .int()
        .min(1)
        .max(81)
        .describe("Verse number (1-81)"),
      context: z
        .string()
        .max(10_000)
        .describe("Your situation or question for contextual commentary"),
    },
    async ({ verse, context }) => {
      if (!hasPrivateKey()) return authError();

      try {
        const result = await x402Post("/v1/verse/commentary", {
          verse,
          context,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch {
        return offlineResponse("verse_commentary");
      }
    },
  );

  server.tool(
    "verse_oracle",
    "Ask the oracle for guidance. AI selects a verse and provides a reading. Costs $0.10 USDC via x402.",
    {
      state: z
        .string()
        .max(10_000)
        .describe("Description of your current situation for the oracle"),
    },
    async ({ state }) => {
      if (!hasPrivateKey()) return authError();

      try {
        const result = await x402Post("/v1/verse/oracle", { state });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch {
        return offlineResponse("verse_oracle");
      }
    },
  );
}
