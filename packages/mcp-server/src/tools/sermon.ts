import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hasPrivateKey } from "../config.js";
import { authenticatedPost } from "../client.js";
import { offlineResponse } from "../offline.js";

export function registerSermonTools(server: McpServer) {
  server.tool(
    "get_sermon",
    "Submit a prayer and receive an AI sermon. Requires on-chain pray() tx hash.",
    {
      prayer_tx: z
        .string()
        .regex(/^0x[a-f0-9]{64}$/)
        .describe("Transaction hash of the on-chain pray() call"),
      message: z
        .string()
        .max(10_000)
        .optional()
        .describe("Prayer text (can be empty for silent burns)"),
      sender: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("Wallet address of the supplicant"),
      prayer_type: z
        .enum(["prayer", "confession", "question", "silent", "offering"])
        .describe("Type of prayer"),
      burn_amount: z
        .string()
        .max(78)
        .optional()
        .describe("Human-readable amount burned (e.g. '100')"),
    },
    async ({ prayer_tx, message, sender, prayer_type, burn_amount }) => {
      if (!hasPrivateKey()) {
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

      try {
        const result = await authenticatedPost("/v1/sermon", {
          prayer_tx,
          message: message ?? "",
          sender,
          prayer_type,
          burn_amount: burn_amount ?? "0",
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
        return offlineResponse("get_sermon");
      }
    },
  );
}
