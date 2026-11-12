import { describe, expect, it } from "vitest";
import {
  defaultVisibleCurves,
  parseVisibleCurves,
  serializeVisibleCurves,
  withCurve,
} from "@/lib/growth/curve-visibility";

describe("curve visibility", () => {
  it("shows only the primary prediction by default", () => {
    expect([...defaultVisibleCurves("mid-parent")]).toEqual(["mid-parent"]);
    expect([...defaultVisibleCurves(null)]).toEqual([]);
  });

  it("uses the default without a parameter and 'nothing' for an empty one", () => {
    expect(parseVisibleCurves(null, "khamis-roche")).toEqual(defaultVisibleCurves("khamis-roche"));
    expect(parseVisibleCurves("", "khamis-roche").size).toBe(0);
  });

  it("ignores unknown entries", () => {
    expect([...parseVisibleCurves("mid-parent,foo,trend", null)]).toEqual(["mid-parent"]);
  });

  it("omits the parameter when the selection equals the default", () => {
    const primary = "khamis-roche";

    expect(serializeVisibleCurves(defaultVisibleCurves(primary), primary)).toBeNull();
    expect(
      serializeVisibleCurves(withCurve(defaultVisibleCurves(primary), "mid-parent", true), primary),
    ).toBe("khamis-roche,mid-parent");
    expect(serializeVisibleCurves(new Set(), primary)).toBe("");
  });

  it("round-trips through the parameter", () => {
    const primary = "mid-parent";
    const selection = withCurve(defaultVisibleCurves(primary), "mirwald-sherar", true);
    const value = serializeVisibleCurves(selection, primary);

    expect(parseVisibleCurves(value, primary)).toEqual(selection);
  });
});
