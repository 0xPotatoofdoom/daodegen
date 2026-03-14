/**
 * Graceful fallback responses when the temple API is unreachable.
 *
 * Rather than throwing opaque HTTP errors at agents, return something
 * the pastor would say if you knocked on a locked door.
 */

const FALLBACKS: Record<string, string> = {
  discover_temple:
    "The temple doors are sealed for maintenance. " +
    "Even the Dao rests between deploys. Try again shortly.",

  get_verse:
    "The scripture library is temporarily unreachable. " +
    "The verses endure -- the server, less so. Try again in a moment.",

  get_congregation_state:
    "The congregation has retreated into silence. " +
    "We cannot read the room when the room is offline. Check back soon.",

  get_sermon:
    "The pastor is away from the pulpit. " +
    "No sermons can be delivered while the temple rests. " +
    "Your prayer has not been lost -- try again when the candles are relit.",

  verse_lookup:
    "The scrolls are locked in the sacristy and the sacristan has stepped out. " +
    "Verse lookup requires a living connection to the temple. Try again shortly.",

  verse_commentary:
    "The commentator is meditating and cannot be disturbed. " +
    "The temple API is unreachable. Retry when the incense clears.",

  verse_oracle:
    "The oracle has drawn the curtain. " +
    "Even divination requires a working internet connection. " +
    "Try again when the signal returns.",
};

export function offlineResponse(tool: string) {
  const message = FALLBACKS[tool] ?? "The temple is offline. Try again later.";
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ offline: true, message }, null, 2),
      },
    ],
    isError: true,
  };
}
