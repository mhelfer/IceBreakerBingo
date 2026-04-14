import { beforeAll, describe, expect, it } from "vitest";
import {
  decodeSession,
  encodeSession,
  type SessionPayload,
} from "@/lib/session-token";

beforeAll(() => {
  process.env.SESSION_COOKIE_SECRET =
    "test-secret-0123456789abcdef0123456789abcdef";
});

describe("encodeSession / decodeSession", () => {
  it("round-trips a facilitator payload", () => {
    const payload: SessionPayload = {
      kind: "facilitator",
      facilitator_id: "00000000-0000-0000-0000-000000000001",
      iat: 1000,
    };
    const token = encodeSession(payload);
    expect(decodeSession(token)).toEqual(payload);
  });

  it("round-trips a player payload", () => {
    const payload: SessionPayload = {
      kind: "player",
      player_id: "00000000-0000-0000-0000-000000000002",
      event_id: "00000000-0000-0000-0000-000000000003",
      iat: 2000,
    };
    const token = encodeSession(payload);
    expect(decodeSession(token)).toEqual(payload);
  });

  it("rejects tampered body", () => {
    const payload: SessionPayload = {
      kind: "facilitator",
      facilitator_id: "x",
      iat: 1,
    };
    const token = encodeSession(payload);
    const dot = token.indexOf(".");
    const tampered = "X" + token.slice(1, dot) + token.slice(dot);
    expect(decodeSession(tampered)).toBeNull();
  });

  it("rejects tampered signature", () => {
    const payload: SessionPayload = {
      kind: "facilitator",
      facilitator_id: "x",
      iat: 1,
    };
    const token = encodeSession(payload);
    const dot = token.indexOf(".");
    const tampered = token.slice(0, dot + 1) + "AAAA" + token.slice(dot + 5);
    expect(decodeSession(tampered)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(decodeSession("not-a-token")).toBeNull();
    expect(decodeSession("")).toBeNull();
  });

  it("rejects when signed under a different secret", () => {
    const payload: SessionPayload = {
      kind: "facilitator",
      facilitator_id: "x",
      iat: 1,
    };
    const token = encodeSession(payload);
    process.env.SESSION_COOKIE_SECRET =
      "different-secret-0123456789abcdef0123456789";
    expect(decodeSession(token)).toBeNull();
    process.env.SESSION_COOKIE_SECRET =
      "test-secret-0123456789abcdef0123456789abcdef";
  });

  it("throws if secret is unset or too short", () => {
    const prev = process.env.SESSION_COOKIE_SECRET;
    process.env.SESSION_COOKIE_SECRET = "short";
    expect(() =>
      encodeSession({
        kind: "facilitator",
        facilitator_id: "x",
        iat: 1,
      }),
    ).toThrow();
    process.env.SESSION_COOKIE_SECRET = prev;
  });
});
