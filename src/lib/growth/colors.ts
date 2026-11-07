import type { PredictionModelId } from "@/lib/growth/analysis";
import type { GrowthSex } from "@/lib/types";
import { getSeriesColor } from "@/lib/series-colors";

/** Farben je Modell, gemeinsam genutzt von Chart und Prognose-Karten. */
export const predictionColors: Record<PredictionModelId, string> = {
  "khamis-roche": getSeriesColor(1),
  "khamis-roche-adjusted": getSeriesColor(3),
  "mid-parent": getSeriesColor(2),
};

/**
 * Farben der KiGGS-Referenzbänder, wenn in der Kurven-Überlagerung beide
 * Geschlechter vorkommen. Bewusst außerhalb der Serien-Palette (Gold, Grün,
 * Terrakotta, Indigo, Weinrot, dann Blau …): ein kühles Hellblau und ein
 * Rosé, die als flächige Bänder mit geringer Deckkraft nicht mit den
 * Personenlinien verwechselt werden. Bei nur einem Geschlecht bleibt das
 * Band neutral wie im Einzel-Chart.
 */
export const referenceBandColors: Record<GrowthSex, string> = {
  male: "#6fa8dc",
  female: "#e08bb0",
};

export const NEUTRAL_REFERENCE_COLOR = "var(--color-foreground)";
