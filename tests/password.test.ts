import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("round-trips", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter2", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter3", hash)).toBe(false);
  });

  it("emits format scrypt$<salt>$<key>", async () => {
    const hash = await hashPassword("whatever");
    const parts = hash.split("$");
    expect(parts[0]).toBe("scrypt");
    expect(parts).toHaveLength(3);
    // Parsing the base64 fields round-trips
    expect(() => Buffer.from(parts[1], "base64")).not.toThrow();
    expect(() => Buffer.from(parts[2], "base64")).not.toThrow();
  });

  it("uses a fresh salt each time", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "scrypt$onlytwo")).toBe(false);
  });
});
