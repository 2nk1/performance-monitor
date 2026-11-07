export type CompareMode = "comparison" | "ranking" | "development" | "growth";

/**
 * Gemeinsame Definition der Vergleichs-Unteransichten: Route + Label. Wird
 * sowohl von der `AppShell` (rendert den Segmented Control als `NavLink`s,
 * unabhängig vom aktuellen Seiteninhalt) als auch von `ComparePage` (weiß
 * anhand des Pfads, welchen Modus sie rendern soll) genutzt, damit beide
 * Stellen nie aus dem Tritt geraten können.
 */
export const compareModes: { mode: CompareMode; path: string; label: string }[] = [
  { mode: "comparison", path: "/compare", label: "Leistungsvergleich" },
  { mode: "ranking", path: "/compare/ranking", label: "Ranking" },
  { mode: "development", path: "/compare/development", label: "Entwicklung" },
  { mode: "growth", path: "/compare/growth", label: "Wachstum" },
];
