import { describe, expect, it } from "vitest";

import { formatConversationDisplay } from "./conversationDisplay";

describe("formatConversationDisplay", () => {
  it("shows the Zernio conversation name before the numeric conversation id", () => {
    expect(
      formatConversationDisplay({
        conversationId: "25944946038444100",
        name: "Nan Napat",
        platform: "facebook",
      }),
    ).toEqual({
      primary: "Nan Napat",
      secondary: "25944946038444100 · facebook",
    });
  });

  it("falls back to the conversation id when no name is available", () => {
    expect(formatConversationDisplay({ conversationId: "25944946038444100" })).toEqual({
      primary: "25944946038444100",
      secondary: "",
    });
  });
});
