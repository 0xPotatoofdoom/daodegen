import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { offlineResponse } from "../offline.js";

export function registerCongregationTools(server: McpServer) {
  server.tool(
    "get_congregation_state",
    "Check the current mood of the congregation -- sentiment, prayer counts, and breakdown",
    {},
    async () => {
      try {
        const state = await get("/v1/congregation/state");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      } catch {
        return offlineResponse("get_congregation_state");
      }
    },
  );
}
