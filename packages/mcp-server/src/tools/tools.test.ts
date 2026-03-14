import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- Mocks ----

// Mock config
vi.mock("../config", () => ({
  getConfig: vi.fn(() => ({
    DAODEGEN_API_URL: "https://api.daodegen.xyz",
    DAODEGEN_PRIVATE_KEY:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  })),
  hasPrivateKey: vi.fn(() => true),
}));

// Mock client
vi.mock("../client", () => ({
  get: vi.fn(),
  post: vi.fn(),
  authenticatedGet: vi.fn(),
  authenticatedPost: vi.fn(),
  x402Post: vi.fn(),
}));

// Mock auth (needed indirectly by client, but we mock client entirely)
vi.mock("../auth", () => ({
  ensureJwt: vi.fn(async () => "mock-jwt"),
  signX402Payment: vi.fn(async () => "mock-proof"),
}));

import { get } from "../client.js";
import { x402Post } from "../client.js";
import { authenticatedPost } from "../client.js";
import { hasPrivateKey } from "../config.js";

// ---- Capture tool registrations from McpServer ----

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: ToolHandler;
}

const registeredTools: RegisteredTool[] = [];

// Create a fake McpServer that captures .tool() calls
function createMockServer() {
  registeredTools.length = 0;
  return {
    tool: vi.fn(
      (
        name: string,
        description: string,
        schema: unknown,
        handler: ToolHandler,
      ) => {
        registeredTools.push({ name, description, schema, handler });
      },
    ),
  };
}

function findTool(name: string): RegisteredTool {
  const tool = registeredTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `Tool "${name}" not found. Registered: ${registeredTools.map((t) => t.name).join(", ")}`,
    );
  }
  return tool;
}

// ---- Import tool registration functions ----

import { registerDiscoveryTools } from "./discovery.js";
import { registerCongregationTools } from "./congregation.js";
import { registerVerseTools } from "./verses.js";
import { registerOracleTools } from "./oracle.js";
import { registerSermonTools } from "./sermon.js";

// ---- Tests ----

beforeEach(() => {
  vi.clearAllMocks();
  const server = createMockServer();

  // Register all tools
  registerDiscoveryTools(server as any);
  registerCongregationTools(server as any);
  registerVerseTools(server as any);
  registerOracleTools(server as any);
  registerSermonTools(server as any);
});

describe("tool registration", () => {
  it("registers all expected tools", () => {
    const names = registeredTools.map((t) => t.name);
    expect(names).toContain("discover_temple");
    expect(names).toContain("get_congregation_state");
    expect(names).toContain("get_verse");
    expect(names).toContain("verse_lookup");
    expect(names).toContain("verse_commentary");
    expect(names).toContain("verse_oracle");
    expect(names).toContain("get_sermon");
    expect(registeredTools).toHaveLength(7);
  });
});

describe("discover_temple", () => {
  it("fetches both soul.json and agent-registration.json", async () => {
    const soulData = { name: "DaoDeGen Temple", type: "temple" };
    const registrationData = { endpoint: "/api/register", version: "1.0" };

    vi.mocked(get)
      .mockResolvedValueOnce(soulData)
      .mockResolvedValueOnce(registrationData);

    const tool = findTool("discover_temple");
    const result = await tool.handler({});

    expect(get).toHaveBeenCalledWith("/.well-known/soul.json");
    expect(get).toHaveBeenCalledWith("/.well-known/agent-registration.json");
    expect(get).toHaveBeenCalledTimes(2);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.soul).toEqual(soulData);
    expect(parsed.registration).toEqual(registrationData);
  });

  it("returns formatted JSON content", async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({ key: "value" })
      .mockResolvedValueOnce({ reg: "data" });

    const tool = findTool("discover_temple");
    const result = await tool.handler({});

    // Verify it is pretty-printed (contains newlines from JSON.stringify null 2)
    expect(result.content[0].text).toContain("\n");
  });
});

describe("get_congregation_state", () => {
  it("fetches congregation state from correct API path", async () => {
    const stateData = {
      sentiment: "faithful",
      prayer_count: 42,
      breakdown: { prayer: 20, confession: 12, question: 10 },
    };

    vi.mocked(get).mockResolvedValueOnce(stateData);

    const tool = findTool("get_congregation_state");
    const result = await tool.handler({});

    expect(get).toHaveBeenCalledWith("/v1/congregation/state");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sentiment).toBe("faithful");
    expect(parsed.prayer_count).toBe(42);
  });
});

describe("get_verse", () => {
  it("calls correct API path with verse_id", async () => {
    const metadata = {
      id: 42,
      text: "The Tao that can be told...",
      title: "Verse 42",
    };

    vi.mocked(get).mockResolvedValueOnce(metadata);

    const tool = findTool("get_verse");
    const result = await tool.handler({ verse_id: 42 });

    expect(get).toHaveBeenCalledWith("/api/verse/42/metadata");
    expect(result.content).toHaveLength(1);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe(42);
    expect(parsed.text).toBe("The Tao that can be told...");
  });

  it("handles different verse IDs (boundary: verse 1)", async () => {
    vi.mocked(get).mockResolvedValueOnce({ id: 1, text: "First verse" });

    const tool = findTool("get_verse");
    await tool.handler({ verse_id: 1 });

    expect(get).toHaveBeenCalledWith("/api/verse/1/metadata");
  });

  it("handles different verse IDs (boundary: verse 81)", async () => {
    vi.mocked(get).mockResolvedValueOnce({ id: 81, text: "Last verse" });

    const tool = findTool("get_verse");
    await tool.handler({ verse_id: 81 });

    expect(get).toHaveBeenCalledWith("/api/verse/81/metadata");
  });
});

describe("verse_lookup", () => {
  it("returns auth error when no private key", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(false);

    const tool = findTool("verse_lookup");
    const result = await tool.handler({ verse: 7 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DAODEGEN_PRIVATE_KEY");
    expect(x402Post).not.toHaveBeenCalled();
  });

  it("calls x402Post with correct path and data", async () => {
    const lookupResult = {
      verse: 7,
      text: "Heaven is eternal",
      interpretation: "A reading about eternity",
    };

    vi.mocked(x402Post).mockResolvedValueOnce(lookupResult);

    const tool = findTool("verse_lookup");
    const result = await tool.handler({ verse: 7 });

    expect(x402Post).toHaveBeenCalledWith("/v1/verse/lookup", { verse: 7 });
    expect(result.content).toHaveLength(1);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.verse).toBe(7);
    expect(parsed.interpretation).toBe("A reading about eternity");
  });
});

describe("verse_commentary", () => {
  it("returns auth error when no private key", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(false);

    const tool = findTool("verse_commentary");
    const result = await tool.handler({ verse: 1, context: "test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DAODEGEN_PRIVATE_KEY");
    expect(x402Post).not.toHaveBeenCalled();
  });

  it("calls x402Post with verse and context", async () => {
    const commentary = { verse: 5, commentary: "Deep insights..." };
    vi.mocked(x402Post).mockResolvedValueOnce(commentary);

    const tool = findTool("verse_commentary");
    const result = await tool.handler({
      verse: 5,
      context: "I am building a DAO",
    });

    expect(x402Post).toHaveBeenCalledWith("/v1/verse/commentary", {
      verse: 5,
      context: "I am building a DAO",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.commentary).toBe("Deep insights...");
  });
});

describe("verse_oracle", () => {
  it("returns auth error when no private key", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(false);

    const tool = findTool("verse_oracle");
    const result = await tool.handler({ state: "confused" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DAODEGEN_PRIVATE_KEY");
    expect(x402Post).not.toHaveBeenCalled();
  });

  it("calls x402Post with state parameter", async () => {
    const oracleResult = { selected_verse: 33, reading: "The oracle speaks..." };
    vi.mocked(x402Post).mockResolvedValueOnce(oracleResult);

    const tool = findTool("verse_oracle");
    const result = await tool.handler({
      state: "Seeking guidance on governance",
    });

    expect(x402Post).toHaveBeenCalledWith("/v1/verse/oracle", {
      state: "Seeking guidance on governance",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.selected_verse).toBe(33);
    expect(parsed.reading).toBe("The oracle speaks...");
  });
});

describe("get_sermon", () => {
  it("returns auth error when no private key", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(false);

    const tool = findTool("get_sermon");
    const result = await tool.handler({
      prayer_tx:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayer_type: "prayer",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DAODEGEN_PRIVATE_KEY");
    expect(authenticatedPost).not.toHaveBeenCalled();
  });

  it("calls authenticatedPost with correct payload", async () => {
    const sermonResult = { sermon: "The temple speaks...", verse: 11 };
    vi.mocked(authenticatedPost).mockResolvedValueOnce(sermonResult);

    const tool = findTool("get_sermon");
    const result = await tool.handler({
      prayer_tx:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "Guide me",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayer_type: "prayer",
      burn_amount: "100",
    });

    expect(authenticatedPost).toHaveBeenCalledWith("/v1/sermon", {
      prayer_tx:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "Guide me",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayer_type: "prayer",
      burn_amount: "100",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.sermon).toBe("The temple speaks...");
  });

  it("uses defaults for optional fields (message='', burn_amount='0')", async () => {
    vi.mocked(authenticatedPost).mockResolvedValueOnce({ sermon: "..." });

    const tool = findTool("get_sermon");
    await tool.handler({
      prayer_tx:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      sender: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      prayer_type: "silent",
      // message and burn_amount omitted
    });

    expect(authenticatedPost).toHaveBeenCalledWith("/v1/sermon", {
      prayer_tx:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      message: "",
      sender: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      prayer_type: "silent",
      burn_amount: "0",
    });
  });
});

describe("offline fallbacks", () => {
  it("discover_temple returns offline message when get rejects", async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("discover_temple");
    const result = await tool.handler({});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("get_congregation_state returns offline message when get rejects", async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("get_congregation_state");
    const result = await tool.handler({});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("get_verse returns offline message when get rejects", async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("get_verse");
    const result = await tool.handler({ verse_id: 1 });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("verse_lookup returns offline message when x402Post rejects", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(true);
    vi.mocked(x402Post).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("verse_lookup");
    const result = await tool.handler({ verse: 7 });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("verse_commentary returns offline message when x402Post rejects", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(true);
    vi.mocked(x402Post).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("verse_commentary");
    const result = await tool.handler({ verse: 5, context: "test context" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("verse_oracle returns offline message when x402Post rejects", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(true);
    vi.mocked(x402Post).mockRejectedValueOnce(new Error("network error"));

    const tool = findTool("verse_oracle");
    const result = await tool.handler({ state: "seeking guidance" });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });

  it("get_sermon returns offline message when authenticatedPost rejects", async () => {
    vi.mocked(hasPrivateKey).mockReturnValueOnce(true);
    vi.mocked(authenticatedPost).mockRejectedValueOnce(
      new Error("network error"),
    );

    const tool = findTool("get_sermon");
    const result = await tool.handler({
      prayer_tx:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sender: "0x1234567890abcdef1234567890abcdef12345678",
      prayer_type: "prayer",
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });
});

describe("tool content format", () => {
  it("all tools return content array with text type", async () => {
    // Set up mocks for all tools to return data
    vi.mocked(get)
      .mockResolvedValueOnce({ soul: true }) // discover_temple: soul.json
      .mockResolvedValueOnce({ reg: true }) // discover_temple: agent-registration.json
      .mockResolvedValueOnce({ state: "ok" }) // get_congregation_state
      .mockResolvedValueOnce({ verse: 1 }); // get_verse

    vi.mocked(x402Post)
      .mockResolvedValueOnce({ lookup: true }) // verse_lookup
      .mockResolvedValueOnce({ commentary: true }) // verse_commentary
      .mockResolvedValueOnce({ oracle: true }); // verse_oracle

    vi.mocked(authenticatedPost).mockResolvedValueOnce({ sermon: true });

    const toolArgs: Record<string, Record<string, unknown>> = {
      discover_temple: {},
      get_congregation_state: {},
      get_verse: { verse_id: 1 },
      verse_lookup: { verse: 1 },
      verse_commentary: { verse: 1, context: "test" },
      verse_oracle: { state: "test" },
      get_sermon: {
        prayer_tx:
          "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        sender: "0x1234567890abcdef1234567890abcdef12345678",
        prayer_type: "prayer",
      },
    };

    for (const tool of registeredTools) {
      const args = toolArgs[tool.name] ?? {};
      const result = await tool.handler(args);

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThanOrEqual(1);
      expect(result.content[0].type).toBe("text");
      expect(typeof result.content[0].text).toBe("string");
    }
  });
});
