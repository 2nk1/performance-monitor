import type { GrowthSex } from "@/lib/types";

/**
 * Referenzperzentile für die Körpergröße aus KiGGS 2003–2006 (Robert
 * Koch-Institut, ca. 17.000 Kinder und Jugendliche in Deutschland).
 *
 * Quelle: Robert Koch-Institut (Hrsg.): Referenzperzentile für anthropo-
 * metrische Maßzahlen und Blutdruck aus der KiGGS-Studie, 2. erweiterte
 * Auflage, Berlin 2013, Kapitel Körperlänge/Körpergröße. Die Tabelle wurde
 * von einer Sekundärquelle übernommen und an je vier Altersstufen pro
 * Geschlecht (12 Monate, 5, 10 und 18 Jahre) gegen das RKI-Dokument geprüft;
 * die Werte stimmen im Rahmen der Rundung auf 0,1 cm überein.
 *
 * Spalten: [Alter in Jahren, P3, P50, P97] in cm. Die Referenz endet mit 18 Jahren.
 */
type Row = readonly [age: number, p3: number, p50: number, p97: number];

export const KIGGS_MAX_AGE = 18;

export const KIGGS_HEIGHT: Record<GrowthSex, readonly Row[]> = {
  male: [
    [0, 47.8, 52.1, 56.4],
    [0.25, 56.7, 61.4, 66.1],
    [0.5, 63.8, 68.4, 73.2],
    [0.75, 68.5, 73.0, 77.8],
    [1, 72.0, 76.6, 81.6],
    [1.5, 77.7, 82.9, 88.4],
    [2, 82.6, 88.2, 94.3],
    [3, 90.5, 97.1, 104.3],
    [4, 97.1, 104.6, 112.6],
    [5, 103.0, 111.2, 120.1],
    [6, 108.9, 117.8, 127.3],
    [7, 115.0, 124.5, 134.7],
    [8, 120.7, 130.8, 141.5],
    [9, 125.5, 136.4, 147.8],
    [10, 129.8, 141.6, 153.8],
    [11, 133.7, 146.7, 160.1],
    [12, 137.9, 152.2, 166.8],
    [13, 143.4, 159.1, 174.7],
    [14, 150.8, 166.9, 182.5],
    [15, 158.0, 173.1, 187.4],
    [16, 162.7, 176.7, 189.7],
    [17, 165.0, 178.2, 190.7],
    [18, 166.1, 179.0, 191.1],
  ],
  female: [
    [0, 47.2, 51.3, 55.5],
    [0.25, 55.1, 59.8, 64.5],
    [0.5, 61.7, 66.5, 71.2],
    [0.75, 66.4, 71.2, 75.9],
    [1, 70.2, 75.1, 79.9],
    [1.5, 76.3, 81.6, 86.9],
    [2, 80.9, 86.7, 92.5],
    [3, 89.1, 95.8, 102.4],
    [4, 96.0, 103.5, 111.0],
    [5, 102.5, 110.8, 119.1],
    [6, 108.5, 117.6, 126.6],
    [7, 113.9, 123.7, 133.4],
    [8, 118.9, 129.5, 140.1],
    [9, 123.8, 135.3, 146.7],
    [10, 128.9, 141.2, 153.4],
    [11, 134.8, 147.7, 160.5],
    [12, 141.5, 154.3, 167.2],
    [13, 147.0, 159.5, 172.1],
    [14, 150.5, 162.7, 175.0],
    [15, 152.5, 164.6, 176.7],
    [16, 153.4, 165.4, 177.4],
    [17, 153.5, 165.5, 177.6],
    [18, 153.8, 165.8, 177.8],
  ],
};
