import { describe, expect, it } from "vitest";
import { feeFor, formatMoney, minorToDecimal, parseDecimalToMinor, splitFee } from "./money";

describe("feeFor (round half up)", () => {
  it("1,005 fils at 100 bps -> fee 10", () => expect(feeFor(1005, 100)).toBe(10));
  it("1,050 fils at 100 bps -> 10.5 rounds up to 11", () => expect(feeFor(1050, 100)).toBe(11));
  it("1,049 fils at 100 bps -> 10", () => expect(feeFor(1049, 100)).toBe(10));
  it("zero fee bps", () => expect(feeFor(9999, 0)).toBe(0));
  it("rejects floats", () => expect(() => feeFor(10.5, 100)).toThrow());
  it("net + fee === subtotal", () => {
    for (const s of [0, 1, 99, 1005, 4321, 123457]) {
      const { feeMinor, netMinor } = splitFee(s, 175);
      expect(feeMinor + netMinor).toBe(s);
    }
  });
});

describe("decimal parsing", () => {
  it("parses POS strings without floats", () => {
    expect(parseDecimalToMinor("18.00")).toBe(1800);
    expect(parseDecimalToMinor("18")).toBe(1800);
    expect(parseDecimalToMinor("0.1")).toBe(10);
    expect(parseDecimalToMinor("19.99")).toBe(1999);
  });
  it("rejects junk", () => {
    expect(() => parseDecimalToMinor("abc")).toThrow();
    expect(() => parseDecimalToMinor("1.234")).toThrow();
  });
  it("round-trips", () => expect(minorToDecimal(5400)).toBe("54.00"));
});

describe("formatMoney", () => {
  it("always shows the currency code", () => expect(formatMoney(2400, "AED")).toBe("AED 24.00"));
  it("thousands", () => expect(formatMoney(123456, "AED")).toBe("AED 1,234.56"));
});
