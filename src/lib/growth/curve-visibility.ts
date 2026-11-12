import type { PredictionModelId } from "@/lib/growth/analysis";

/**
 * Zielgrößen-Kacheln, die sich im Diagramm ein- und ausschalten lassen. Zu
 * jeder gehören Zielmarke, Fehlerbereich und Verlauf. Die Khamis-Roche-Variante
 * mit Entwicklungsalter folgt der Khamis-Roche-Kachel.
 */
export const CURVE_KEYS = ["khamis-roche", "mid-parent", "mirwald-sherar"] as const;

export type CurveKey = (typeof CURVE_KEYS)[number];

/** Query-Parameter, in dem die Auswahl in der URL steht. */
export const CURVES_PARAM = "kurven";

const isCurveKey = (value: string): value is CurveKey =>
  (CURVE_KEYS as readonly string[]).includes(value);

/** Standard: nur die Hauptquelle an. */
export function defaultVisibleCurves(primary: PredictionModelId | null): Set<CurveKey> {
  const visible = new Set<CurveKey>();

  if (primary && isCurveKey(primary)) {
    visible.add(primary);
  }

  return visible;
}

/**
 * Auswahl aus dem URL-Parameter. Fehlt er, gilt der Standard; ein leerer Wert
 * heißt bewusst "alles aus". Unbekannte Einträge werden ignoriert.
 */
export function parseVisibleCurves(
  param: string | null,
  primary: PredictionModelId | null,
): Set<CurveKey> {
  if (param === null) {
    return defaultVisibleCurves(primary);
  }

  return new Set(param.split(",").filter(isCurveKey));
}

/** Parameterwert in fester Reihenfolge; null, wenn die Auswahl dem Standard entspricht. */
export function serializeVisibleCurves(
  visible: Set<CurveKey>,
  primary: PredictionModelId | null,
): string | null {
  const encode = (set: Set<CurveKey>) => CURVE_KEYS.filter((key) => set.has(key)).join(",");
  const value = encode(visible);

  return value === encode(defaultVisibleCurves(primary)) ? null : value;
}

export function withCurve(visible: Set<CurveKey>, key: CurveKey, on: boolean): Set<CurveKey> {
  const next = new Set(visible);

  if (on) {
    next.add(key);
  } else {
    next.delete(key);
  }

  return next;
}
