import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need dynamic imports because getConfig caches at module level.
// vi.resetModules() forces re-evaluation so the _config cache is cleared.

const VALID_ENV = {
  DAODEGEN_API_URL: "https://api.daodegen.xyz",
  DAODEGEN_PRIVATE_KEY:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  vi.resetModules();
});

afterEach(() => {
  process.env = savedEnv;
});

describe("getConfig", () => {
  it("returns a valid config when all required fields are present", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_PRIVATE_KEY = VALID_ENV.DAODEGEN_PRIVATE_KEY;

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.DAODEGEN_API_URL).toBe(VALID_ENV.DAODEGEN_API_URL);
    expect(config.DAODEGEN_PRIVATE_KEY).toBe(VALID_ENV.DAODEGEN_PRIVATE_KEY);
  });

  it("accepts config without optional DAODEGEN_PRIVATE_KEY", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    delete process.env.DAODEGEN_PRIVATE_KEY;

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.DAODEGEN_API_URL).toBe(VALID_ENV.DAODEGEN_API_URL);
    expect(config.DAODEGEN_PRIVATE_KEY).toBeUndefined();
  });

  it("accepts optional DAODEGEN_FACILITATOR_URL", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_FACILITATOR_URL = "https://facilitator.example.com";

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.DAODEGEN_FACILITATOR_URL).toBe(
      "https://facilitator.example.com",
    );
  });

  it("throws when required DAODEGEN_API_URL is missing", async () => {
    delete process.env.DAODEGEN_API_URL;
    delete process.env.DAODEGEN_PRIVATE_KEY;

    const { getConfig } = await import("./config.js");

    expect(() => getConfig()).toThrow("Invalid MCP server configuration");
  });

  it("throws when DAODEGEN_API_URL is not a valid URL", async () => {
    process.env.DAODEGEN_API_URL = "not-a-url";

    const { getConfig } = await import("./config.js");

    expect(() => getConfig()).toThrow("Invalid MCP server configuration");
  });

  it("throws when DAODEGEN_PRIVATE_KEY has invalid format", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_PRIVATE_KEY = "bad-key";

    const { getConfig } = await import("./config.js");

    expect(() => getConfig()).toThrow("Invalid MCP server configuration");
  });

  it("throws when DAODEGEN_PRIVATE_KEY is missing 0x prefix", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_PRIVATE_KEY =
      "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    const { getConfig } = await import("./config.js");

    expect(() => getConfig()).toThrow("Invalid MCP server configuration");
  });

  it("throws when DAODEGEN_PRIVATE_KEY is too short", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_PRIVATE_KEY = "0xdeadbeef";

    const { getConfig } = await import("./config.js");

    expect(() => getConfig()).toThrow("Invalid MCP server configuration");
  });

  it("defaults ACTIVE_CHAIN to sepolia", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    delete process.env.ACTIVE_CHAIN;

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.ACTIVE_CHAIN).toBe("sepolia");
  });

  it("accepts ACTIVE_CHAIN=mainnet", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.ACTIVE_CHAIN = "mainnet";

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.ACTIVE_CHAIN).toBe("mainnet");
  });

  it("defaults RPC URL from chain preset when not provided", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    delete process.env.DAODEGEN_RPC_URL;

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.DAODEGEN_RPC_URL).toBe("https://sepolia.unichain.org");
  });

  it("allows DAODEGEN_RPC_URL override", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.DAODEGEN_RPC_URL = "https://custom-rpc.example.com";

    const { getConfig } = await import("./config.js");
    const config = getConfig();

    expect(config.DAODEGEN_RPC_URL).toBe("https://custom-rpc.example.com");
  });

  it("caches config on subsequent calls", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;

    const { getConfig } = await import("./config.js");
    const first = getConfig();
    const second = getConfig();

    expect(first).toBe(second); // strict reference equality
  });

  it("cached config is not affected by env changes after first call", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;

    const { getConfig } = await import("./config.js");
    const first = getConfig();

    process.env.DAODEGEN_API_URL = "https://other.example.com";
    const second = getConfig();

    expect(second.DAODEGEN_API_URL).toBe(VALID_ENV.DAODEGEN_API_URL);
    expect(first).toBe(second);
  });
});

describe("getChain", () => {
  it("returns unichainSepolia for sepolia preset", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    delete process.env.ACTIVE_CHAIN;

    const { getChain } = await import("./config.js");
    const chain = getChain();

    expect(chain.id).toBe(1301);
  });

  it("returns unichain for mainnet preset", async () => {
    process.env.DAODEGEN_API_URL = VALID_ENV.DAODEGEN_API_URL;
    process.env.ACTIVE_CHAIN = "mainnet";

    const { getChain } = await import("./config.js");
    const chain = getChain();

    expect(chain.id).toBe(130);
  });
});

describe("hasPrivateKey", () => {
  it("returns true when DAODEGEN_PRIVATE_KEY is set", async () => {
    process.env.DAODEGEN_PRIVATE_KEY = VALID_ENV.DAODEGEN_PRIVATE_KEY;

    const { hasPrivateKey } = await import("./config.js");

    expect(hasPrivateKey()).toBe(true);
  });

  it("returns false when DAODEGEN_PRIVATE_KEY is not set", async () => {
    delete process.env.DAODEGEN_PRIVATE_KEY;

    const { hasPrivateKey } = await import("./config.js");

    expect(hasPrivateKey()).toBe(false);
  });

  it("returns false when DAODEGEN_PRIVATE_KEY is empty string", async () => {
    process.env.DAODEGEN_PRIVATE_KEY = "";

    const { hasPrivateKey } = await import("./config.js");

    expect(hasPrivateKey()).toBe(false);
  });
});
