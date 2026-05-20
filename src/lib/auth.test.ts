import { describe, expect, it } from "vitest";

import { createSessionToken, isSessionTokenValid, verifyPassword } from "./auth";

describe("auth helpers", () => {
  it("verifies password using ADMIN_PASSWORD", () => {
    expect(verifyPassword("secret", "secret")).toBe(true);
    expect(verifyPassword("wrong", "secret")).toBe(false);
  });

  it("creates signed session tokens that reject tampering", () => {
    const token = createSessionToken("secret", 1_800_000_000_000);

    expect(isSessionTokenValid(token, "secret", 1_800_000_001_000)).toBe(true);
    expect(isSessionTokenValid(`${token}x`, "secret", 1_800_000_001_000)).toBe(false);
    expect(isSessionTokenValid(token, "other-secret", 1_800_000_001_000)).toBe(false);
  });
});
