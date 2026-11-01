import type { PredictionModelId } from "@/lib/growth/analysis";
import { getSeriesColor } from "@/lib/series-colors";

/** Farben je Modell, gemeinsam genutzt von Chart und Prognose-Karten. */
export const predictionColors: Record<PredictionModelId, string> = {
  "khamis-roche": getSeriesColor(1),
  "mid-parent": getSeriesColor(2),
};
