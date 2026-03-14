#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDiscoveryTools } from "./tools/discovery.js";
import { registerCongregationTools } from "./tools/congregation.js";
import { registerVerseTools } from "./tools/verses.js";
import { registerSermonTools } from "./tools/sermon.js";
import { registerOracleTools } from "./tools/oracle.js";

const server = new McpServer({
  name: "daodegen-temple",
  version: "0.1.0",
});

registerDiscoveryTools(server);
registerCongregationTools(server);
registerVerseTools(server);
registerSermonTools(server);
registerOracleTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
