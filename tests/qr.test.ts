import { describe, expect, it } from "vitest";
import { decodeQrPayload, encodeQrPayload } from "@/lib/qr";

describe("qr payload", () => {
  it("round-trips a well-formed payload", () => {
    const p = { eventCode: "Q2ENG", playerId: "abc-123", qrNonce: "xYz_-9" };
    expect(decodeQrPayload(encodeQrPayload(p))).toEqual(p);
  });

  it("trims whitespace", () => {
    const raw = "  ibb:Q2ENG:abc:xyz  \n";
    expect(decodeQrPayload(raw)).toEqual({
      eventCode: "Q2ENG",
      playerId: "abc",
      qrNonce: "xyz",
    });
  });

  it("rejects missing prefix", () => {
    expect(decodeQrPayload("Q2ENG:abc:xyz")).toBeNull();
  });

  it("rejects wrong part count", () => {
    expect(decodeQrPayload("ibb:Q2ENG:abc")).toBeNull();
    expect(decodeQrPayload("ibb:Q2ENG:abc:xyz:extra")).toBeNull();
  });

  it("rejects empty segments", () => {
    expect(decodeQrPayload("ibb:Q2ENG::xyz")).toBeNull();
    expect(decodeQrPayload("ibb:::")).toBeNull();
  });
});
