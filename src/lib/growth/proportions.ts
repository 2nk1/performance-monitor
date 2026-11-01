/**
 * Verhältnis Armspannweite zu Körpergröße. Bei den meisten liegt es zwischen
 * 0,97 und 1,03. Es ändert sich im Wachstum und ist erst nach dem Wachstums-
 * ende gut interpretierbar.
 */
export function armSpanRatio(armSpanCm: number | null, heightCm: number): number | null {
  if (armSpanCm === null || heightCm <= 0) {
    return null;
  }

  return armSpanCm / heightCm;
}
