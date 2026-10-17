import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLongLivedToken, refreshLongLivedToken } from "../lib/meta/client";

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_APP_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Instagram token endpoints", () => {
  it("uses POST for long-lived token exchange", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: "ll-token", expires_in: 120 }))
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLongLivedToken("short-token")).resolves.toEqual({
      accessToken: "ll-token",
      expiresIn: 120,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("falls back to GET when the endpoint rejects POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 100, message: "Unsupported request - method type: post" },
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "refreshed", expires_in: 300 }))
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshLongLivedToken("existing-token")).resolves.toEqual({
      accessToken: "refreshed",
      expiresIn: 300,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1]?.[1]).toBeUndefined();
  });
});
