import { describe, it, expect, beforeEach } from "vitest";
import {
  recordPrayer,
  getState,
  getSummary,
  _resetForTesting,
} from "./congregation";

describe("Congregation State", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("starts with peaceful sentiment and zero prayers", () => {
    const state = getState();
    expect(state.sentiment).toBe("peaceful");
    expect(state.prayersInWindow).toBe(0);
    expect(state.uniqueSupplicants).toBe(0);
    expect(state.windowHours).toBe(24);
    expect(state.totalPrayers).toBe(0);
    expect(state.totalSermons).toBe(0);
  });

  it("records a prayer and updates state", () => {
    recordPrayer("0xabc", "seeking");
    const state = getState();
    expect(state.sentiment).toBe("seeking");
    expect(state.prayersInWindow).toBe(1);
    expect(state.uniqueSupplicants).toBe(1);
    expect(state.totalPrayers).toBe(1);
    expect(state.breakdown.seeking).toBe(1);
  });

  it("tracks unique supplicants", () => {
    recordPrayer("0xabc", "seeking");
    recordPrayer("0xdef", "grateful");
    recordPrayer("0xabc", "confused");
    const state = getState();
    expect(state.uniqueSupplicants).toBe(2);
    expect(state.prayersInWindow).toBe(3);
  });

  it("dominant sentiment is the most frequent tag", () => {
    recordPrayer("0x1", "seeking");
    recordPrayer("0x2", "seeking");
    recordPrayer("0x3", "grateful");
    const state = getState();
    expect(state.sentiment).toBe("seeking");
  });

  it("getSummary returns human-readable text", () => {
    recordPrayer("0xabc", "grieving");
    const summary = getSummary();
    expect(summary).toContain("grieving");
    expect(summary).toContain("1 prayers");
    expect(summary).toContain("1 addresses");
  });

  it("getSummary returns quiet message when no prayers", () => {
    const summary = getSummary();
    expect(summary).toContain("quiet");
  });
});
