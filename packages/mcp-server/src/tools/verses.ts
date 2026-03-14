import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { offlineResponse } from "../offline.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Embedded verses for offline fallback
interface Verse {
  id: number;
  title: string;
  body: string;
  alpha: string;
  image: string;
}

let _verses: Verse[] | null = null;

function getEmbeddedVerses(): Verse[] {
  if (_verses) return _verses;
  try {
    // Try loading from bundled data
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const versesPath = resolve(__dirname, "../data/verses.json");
    _verses = JSON.parse(readFileSync(versesPath, "utf-8")) as Verse[];
  } catch {
    try {
      // Fallback: try relative to cwd
      _verses = JSON.parse(readFileSync("src/data/verses.json", "utf-8")) as Verse[];
    } catch {
      _verses = [];
    }
  }
  return _verses;
}

export function registerVerseTools(server: McpServer) {
  server.tool(
    "get_verse",
    "Get metadata and text for a specific verse (1-81). Works offline with embedded verses.",
    {
      verse_id: z
        .number()
        .int()
        .min(1)
        .max(81)
        .describe("Verse number (1-81)"),
    },
    async ({ verse_id }) => {
      // Try live API first
      try {
        const metadata = await get(`/api/verse/${verse_id}/metadata`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(metadata, null, 2),
            },
          ],
        };
      } catch {
        // Fallback to embedded verses
        const verses = getEmbeddedVerses();
        const verse = verses.find((v) => v.id === verse_id);
        if (verse) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    ...verse,
                    _source: "embedded",
                    _note: "Served from local cache — temple API is offline",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        return offlineResponse("get_verse");
      }
    },
  );

  // New tool: list all verses (offline-capable)
  server.tool(
    "list_verses",
    "List all 81 verses with titles and IDs. Works offline.",
    {},
    async () => {
      // Try live API first
      try {
        const data = await get("/api/verses");
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch {
        // Fallback to embedded
        const verses = getEmbeddedVerses();
        const summary = verses.map((v) => ({ id: v.id, title: v.title }));
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { verses: summary, _source: "embedded", total: summary.length },
                null,
                2
              ),
            },
          ],
        };
      }
    },
  );
}
