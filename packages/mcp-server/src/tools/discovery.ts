import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { offlineResponse } from "../offline.js";

export function registerDiscoveryTools(server: McpServer) {
  server.tool(
    "discover_temple",
    "Read the temple's identity, endpoints, and agent registration spec",
    {},
    async () => {
      try {
        const [soul, registration] = await Promise.all([
          get("/.well-known/soul.json"),
          get("/.well-known/agent-registration.json"),
        ]);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ soul, registration }, null, 2),
            },
          ],
        };
      } catch {
        return offlineResponse("discover_temple");
      }
    },
  );
}
