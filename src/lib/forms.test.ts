import { describe, expect, it } from "vitest";
import { parseGrowthProfileForm, parseOptionalDate } from "@/lib/forms";

describe("parseOptionalDate", () => {
  it("returns null for empty or missing values", () => {
    expect(parseOptionalDate(null, "Geburtsdatum")).toBeNull();
    expect(parseOptionalDate("", "Geburtsdatum")).toBeNull();
    expect(parseOptionalDate("  ", "Geburtsdatum")).toBeNull();
  });

  it("accepts a valid date", () => {
    expect(parseOptionalDate("2012-03-04", "Geburtsdatum")).toBe("2012-03-04");
  });

  it("rejects invalid or implausible dates", () => {
    expect(() => parseOptionalDate("04.03.2012", "Geburtsdatum")).toThrow("gültiges Datum");
    expect(() => parseOptionalDate("2012-13-40", "Geburtsdatum")).toThrow("gültiges Datum");
    expect(() => parseOptionalDate("1800-01-01", "Geburtsdatum")).toThrow("zwischen 1900 und 2100");
  });
});

describe("parseGrowthProfileForm", () => {
  it("needs no birth date and treats the advanced fields as optional", () => {
    const form = new FormData();
    form.set("sex", "female");
    form.set("mother_height_cm", "168");

    expect(parseGrowthProfileForm(form)).toEqual({
      sex: "female",
      motherHeight: 168,
      fatherHeight: null,
      maturityOverride: null,
      maturityDelay: null,
    });
  });

  it("requires the sex", () => {
    expect(() => parseGrowthProfileForm(new FormData())).toThrow("Geschlecht fehlt");
  });
});
