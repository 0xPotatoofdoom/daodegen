import { describe, it, expect, beforeEach } from "vitest";
import {
  addBroadcast,
  getFeed,
  getBroadcastStats,
  _resetForTesting,
} from "./broadcasts";

describe("broadcasts", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  describe("addBroadcast", () => {
    it("returns a broadcast with correct fields, lowercase address, isAgent true, and generated id/timestamp", () => {
      const result = addBroadcast({
        message: "hello world",
        verseNumber: 42,
        agentAddress: "0xAbCdEf1234567890",
      });

      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.message).toBe("hello world");
      expect(result.verseNumber).toBe(42);
      expect(result.agentAddress).toBe("0xabcdef1234567890");
      expect(result.isAgent).toBe(true);
      expect(result.timestamp).toBeTruthy();
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });

    it("caps broadcasts at MAX_BROADCASTS (500)", () => {
      for (let i = 0; i < 510; i++) {
        addBroadcast({
          message: `msg-${i}`,
          verseNumber: 1,
          agentAddress: "0xaaa",
        });
      }

      const stats = getBroadcastStats();
      expect(stats.totalBroadcasts).toBe(500);

      // The first 10 should have been evicted; the oldest remaining is msg-10
      const feed = getFeed(500);
      expect(feed[feed.length - 1].message).toBe("msg-10");
      expect(feed[0].message).toBe("msg-509");
    });
  });

  describe("getFeed", () => {
    it("returns newest first (reversed order)", () => {
      addBroadcast({ message: "first", verseNumber: 1, agentAddress: "0xa" });
      addBroadcast({ message: "second", verseNumber: 2, agentAddress: "0xb" });
      addBroadcast({ message: "third", verseNumber: 3, agentAddress: "0xc" });

      const feed = getFeed();
      expect(feed[0].message).toBe("third");
      expect(feed[1].message).toBe("second");
      expect(feed[2].message).toBe("first");
    });

    it("respects the limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        addBroadcast({
          message: `msg-${i}`,
          verseNumber: 1,
          agentAddress: "0xa",
        });
      }

      const feed = getFeed(3);
      expect(feed).toHaveLength(3);
      expect(feed[0].message).toBe("msg-9");
      expect(feed[1].message).toBe("msg-8");
      expect(feed[2].message).toBe("msg-7");
    });

    it("defaults to limit of 50", () => {
      for (let i = 0; i < 60; i++) {
        addBroadcast({
          message: `msg-${i}`,
          verseNumber: 1,
          agentAddress: "0xa",
        });
      }

      const feed = getFeed();
      expect(feed).toHaveLength(50);
      // newest should be msg-59
      expect(feed[0].message).toBe("msg-59");
    });

    it("returns empty array when no broadcasts exist", () => {
      const feed = getFeed();
      expect(feed).toEqual([]);
    });
  });

  describe("getBroadcastStats", () => {
    it("returns correct totalBroadcasts, activeAgents, and agents list", () => {
      addBroadcast({ message: "a", verseNumber: 1, agentAddress: "0xAAA" });
      addBroadcast({ message: "b", verseNumber: 2, agentAddress: "0xBBB" });
      addBroadcast({ message: "c", verseNumber: 3, agentAddress: "0xAAA" });

      const stats = getBroadcastStats();
      expect(stats.totalBroadcasts).toBe(3);
      expect(stats.activeAgents).toBe(2);
      expect(stats.agents).toContain("0xaaa");
      expect(stats.agents).toContain("0xbbb");
      expect(stats.agents).toHaveLength(2);
    });

    it("returns topVerses sorted by count descending, capped at 10", () => {
      // Create 12 distinct verses with varying counts
      for (let verse = 1; verse <= 12; verse++) {
        for (let j = 0; j < verse; j++) {
          addBroadcast({
            message: `v${verse}-${j}`,
            verseNumber: verse,
            agentAddress: "0xa",
          });
        }
      }

      const stats = getBroadcastStats();
      expect(stats.topVerses).toHaveLength(10);
      // Highest count verse (12) should be first
      expect(stats.topVerses[0]).toEqual({ verse: 12, count: 12 });
      expect(stats.topVerses[1]).toEqual({ verse: 11, count: 11 });
      // Lowest in the top 10 should be verse 3 (count 3)
      expect(stats.topVerses[9]).toEqual({ verse: 3, count: 3 });
    });

    it("returns zeros/empty when no broadcasts exist", () => {
      const stats = getBroadcastStats();
      expect(stats.totalBroadcasts).toBe(0);
      expect(stats.activeAgents).toBe(0);
      expect(stats.agents).toEqual([]);
      expect(stats.topVerses).toEqual([]);
    });
  });

  describe("_resetForTesting", () => {
    it("clears all broadcasts", () => {
      addBroadcast({ message: "x", verseNumber: 1, agentAddress: "0xa" });
      addBroadcast({ message: "y", verseNumber: 2, agentAddress: "0xb" });
      expect(getFeed()).toHaveLength(2);

      _resetForTesting();

      expect(getFeed()).toEqual([]);
      expect(getBroadcastStats().totalBroadcasts).toBe(0);
    });
  });
});
