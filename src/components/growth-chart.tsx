import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  GrowthAnalysis,
  GrowthPoint,
  Prediction,
  PredictionModelId,
  TrajectoryModel,
} from "@/lib/growth/analysis";
import type { CurveKey } from "@/lib/growth/curve-visibility";
import { referenceCurve } from "@/lib/growth/percentiles";
import { timingLabels } from "@/lib/growth/timing";
import type { MirwaldCurve } from "@/lib/growth/trajectory";
import type { GrowthSex } from "@/lib/types";
import { predictionColors } from "@/lib/growth/colors";
import { getSeriesColor } from "@/lib/series-colors";

const HEIGHT_COLOR = getSeriesColor(0);

type GrowthChartProps = {
  points: GrowthPoint[];
  predictions: Prediction[];
  modelTrajectories: GrowthAnalysis["modelTrajectories"];
  /** Verlauf zur Mirwald/Sherar-Zielgröße mit Band. */
  mirwaldCurve: MirwaldCurve | null;
  /** Grund je Modell, warum es keinen Verlauf gibt. */
  curveNotes: GrowthAnalysis["curveNotes"];
  sex: GrowthSex;
  visible: Set<CurveKey>;
};

const formatCm = (value: number) => `${value.toFixed(1).replace(".", ",")} cm`;

/** Ein Verlauf zu einer Zielgröße: dünne Linien und ein Band, alles in der Farbe der Kachel. */
type CurveSet = {
  id: PredictionModelId;
  label: string;
  color: string;
  ages: number[];
  lines: { name: string; heights: number[]; dotted: boolean }[];
  band: { kind: "error" | "types"; lo: number[]; hi: number[] } | null;
};

export function GrowthChart({
  points,
  predictions,
  modelTrajectories,
  mirwaldCurve,
  curveNotes,
  sex,
  visible,
}: GrowthChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-card-border bg-card text-sm text-foreground/60">
        Noch keine Messungen vorhanden.
      </div>
    );
  }

  const latest = points[points.length - 1];
  // Die Variante mit Entwicklungsalter folgt der Khamis-Roche-Kachel.
  const available = predictions.filter(
    (prediction): prediction is Prediction & { value: number } =>
      prediction.value !== null &&
      visible.has(prediction.id === "khamis-roche-adjusted" ? "khamis-roche" : prediction.id),
  );
  const labelOf = (id: PredictionModelId) =>
    predictions.find((prediction) => prediction.id === id)?.label ?? id;

  // Zu jeder aktiven Kachel gehört ihr Verlauf.
  const curveSets: CurveSet[] = [];

  for (const model of ["khamis-roche", "mid-parent"] as TrajectoryModel[]) {
    const trajectories = modelTrajectories[model];

    if (!visible.has(model) || !trajectories) continue;

    const known = trajectories.curves.find((curve) => curve.group === trajectories.activeGroup);
    const shown = known ? [known] : trajectories.curves;
    const spread = trajectories.curves.length > 1;

    curveSets.push({
      id: model,
      label: labelOf(model),
      color: predictionColors[model],
      ages: trajectories.ages,
      lines: shown.map((curve) => ({
        name: `Verlauf ${labelOf(model)}${known ? "" : ` (${timingLabels[curve.group]})`}`,
        heights: curve.heights,
        dotted: !known && curve.group !== "average",
      })),
      band: spread
        ? {
            kind: "types",
            lo: trajectories.ages.map((_, index) =>
              Math.min(...trajectories.curves.map((curve) => curve.heights[index])),
            ),
            hi: trajectories.ages.map((_, index) =>
              Math.max(...trajectories.curves.map((curve) => curve.heights[index])),
            ),
          }
        : null,
    });
  }

  if (visible.has("mirwald-sherar") && mirwaldCurve) {
    curveSets.push({
      id: "mirwald-sherar",
      label: labelOf("mirwald-sherar"),
      color: predictionColors["mirwald-sherar"],
      ages: mirwaldCurve.ages,
      lines: [{ name: "Verlauf Mirwald/Sherar", heights: mirwaldCurve.heights, dotted: false }],
      band: mirwaldCurve.band,
    });
  }

  const mirwaldErrorBandEnd =
    curveSets
      .find((set) => set.id === "mirwald-sherar" && set.band?.kind === "error")
      ?.ages.at(-1) ?? null;

  const notes = (["khamis-roche", "mid-parent", "mirwald-sherar"] as const).flatMap((id) =>
    visible.has(id) && curveNotes[id] ? [`${labelOf(id)}: ${curveNotes[id]}`] : [],
  );

  const xMin = Math.floor(points[0].age) - 0.5;
  const xMax = Math.max(
    18.5,
    Math.ceil(latest.age) + 1,
    ...curveSets.map((set) => Math.ceil(set.ages.at(-1) ?? 0) + 0.5),
  );

  const reference = referenceCurve(sex, xMin, xMax);

  const yValues = [
    ...reference.flatMap((point) => [point.p3, point.p97]),
    ...points.map((point) => point.height_cm),
    ...points.flatMap((point) => (point.khamisRoche !== null ? [point.khamisRoche] : [])),
    ...curveSets.flatMap((set) => [
      ...set.lines.flatMap((line) => line.heights),
      ...(set.band?.lo ?? []),
      ...(set.band?.hi ?? []),
    ]),
    ...available.flatMap((prediction) => [
      prediction.value - (prediction.range ?? 0),
      prediction.value + (prediction.range ?? 0),
    ]),
  ];
  const yMin = Math.floor((Math.min(...yValues) - 5) / 10) * 10;
  const yMax = Math.ceil((Math.max(...yValues) + 3) / 10) * 10;
  const yTicks = Array.from({ length: (yMax - yMin) / 10 + 1 }, (_, i) => yMin + i * 10);

  type Row = {
    age: number;
    height?: number;
    khamisRoche?: number | null;
    /** KiGGS-Referenz: Bereich P3 bis P97 und Median. */
    band?: [number, number];
    median?: number;
    /** Verläufe und ihre Bänder je Kachel, Schlüssel `c<Nr>l<Nr>` bzw. `c<Nr>b`. */
    [curveKey: string]: number | [number, number] | null | undefined;
  };

  const data: Row[] = points.map((point) => ({
    age: point.age,
    height: point.height_cm,
    khamisRoche: point.khamisRoche,
  }));

  curveSets.forEach((set, setIndex) => {
    set.ages.forEach((age, index) => {
      const row: Row = { age };

      set.lines.forEach((line, lineIndex) => {
        row[`c${setIndex}l${lineIndex}`] = line.heights[index];
      });

      if (set.band) {
        row[`c${setIndex}b`] = [set.band.lo[index], set.band.hi[index]];
      }

      data.push(row);
    });
  });

  reference.forEach((point) =>
    data.push({ age: point.age, band: [point.p3, point.p97], median: point.p50 }),
  );
  data.sort((a, b) => a.age - b.age);
  const hasKrHistory = points.some((point) => point.khamisRoche !== null);
  const hasTypeBand = curveSets.some((set) => set.band?.kind === "types");
  const hasErrorBand = curveSets.some((set) => set.band?.kind === "error");

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
        <LegendItem color={HEIGHT_COLOR} label="Gemessene Größe" />
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-5 rounded-sm"
            style={{ background: "var(--color-foreground)", opacity: 0.12 }}
          />
          KiGGS P3 bis P97
        </span>
        {hasKrHistory ? (
          <LegendItem
            color={predictionColors["khamis-roche"]}
            label="Khamis-Roche je Messung"
            dashed
          />
        ) : null}
        {available.map((prediction) => (
          <LegendItem
            key={prediction.id}
            color={predictionColors[prediction.id]}
            label={`Zielgröße ${prediction.label}`}
            dashed
          />
        ))}
        {curveSets.length > 0 ? (
          <LegendItem thin color="var(--color-foreground)" label="Möglicher Verlauf" />
        ) : null}
        {hasTypeBand ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: "var(--color-foreground)", opacity: 0.25 }}
            />
            Band: je nach Entwicklungstyp
          </span>
        ) : null}
        {hasErrorBand ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: "var(--color-foreground)", opacity: 0.25 }}
            />
            Band: Fehlerbereich
          </span>
        ) : null}
      </div>

      {notes.length > 0 ? (
        <p className="mb-3 text-xs text-foreground/60">Kein Verlauf: {notes.join(" · ")}</p>
      ) : null}

      <ComposedChart
        responsive
        width="100%"
        height={380}
        data={data}
        margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />

        <XAxis
          type="number"
          dataKey="age"
          domain={[xMin, xMax]}
          allowDecimals={false}
          tickCount={Math.min(15, Math.round(xMax - xMin) + 1)}
          tickFormatter={(value) => `${value}`}
          tickLine={false}
          label={{ value: "Alter (Jahre)", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          domain={[yMin, yMax]}
          ticks={yTicks}
          tickLine={false}
          axisLine={false}
          width={60}
          unit=" cm"
        />

        <Area
          type="monotone"
          dataKey="band"
          stroke="none"
          fill="var(--color-foreground)"
          fillOpacity={0.07}
          connectNulls
          tooltipType="none"
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="median"
          stroke="var(--color-foreground)"
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray="2 3"
          dot={false}
          activeDot={false}
          connectNulls
          tooltipType="none"
          isAnimationActive={false}
        />

        {curveSets.map((set, setIndex) =>
          set.band ? (
            <Area
              key={`${set.id}-band`}
              type="monotone"
              dataKey={`c${setIndex}b`}
              stroke="none"
              fill={set.color}
              fillOpacity={0.14}
              connectNulls
              tooltipType="none"
              activeDot={false}
              isAnimationActive={false}
            />
          ) : null,
        )}

        {available.map((prediction) =>
          prediction.range ? (
            <ReferenceArea
              key={`${prediction.id}-area`}
              // Mit Verlaufsband öffnet sich der Fehlerbereich erst bis zum Ende der Kurve.
              x1={
                prediction.id === "mirwald-sherar"
                  ? (mirwaldErrorBandEnd ?? latest.age)
                  : latest.age
              }
              x2={xMax}
              y1={prediction.value - prediction.range}
              y2={prediction.value + prediction.range}
              fill={predictionColors[prediction.id]}
              fillOpacity={0.08}
              stroke="none"
              ifOverflow="hidden"
            />
          ) : null,
        )}

        {available.map((prediction) => (
          <ReferenceLine
            key={prediction.id}
            segment={[
              { x: latest.age, y: prediction.value },
              { x: xMax, y: prediction.value },
            ]}
            stroke={predictionColors[prediction.id]}
            strokeDasharray="6 4"
            strokeWidth={2}
          />
        ))}

        <Tooltip
          labelFormatter={(value) => `Alter ${Number(value).toFixed(1).replace(".", ",")} J.`}
          formatter={(value, name) => [
            formatCm(Number(value)),
            name === "height"
              ? "Größe"
              : name === "khamisRoche"
                ? "Khamis-Roche-Prognose"
                : String(name),
          ]}
          contentStyle={{
            backgroundColor: "var(--color-header)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
          }}
          labelStyle={{ color: "var(--color-sage)" }}
          itemStyle={{ color: "#fff" }}
        />

        {hasKrHistory ? (
          <Line
            type="linear"
            dataKey="khamisRoche"
            stroke={predictionColors["khamis-roche"]}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            dot={{ r: 3, fill: predictionColors["khamis-roche"] }}
            connectNulls
            isAnimationActive={false}
          />
        ) : null}

        {curveSets.flatMap((set, setIndex) =>
          set.lines.map((line, lineIndex) => (
            <Line
              key={`${set.id}-${lineIndex}`}
              type="monotone"
              dataKey={`c${setIndex}l${lineIndex}`}
              name={line.name}
              stroke={set.color}
              strokeWidth={1}
              strokeDasharray={line.dotted ? "2 3" : undefined}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          )),
        )}

        <Line
          type="monotone"
          dataKey="height"
          connectNulls
          stroke={HEIGHT_COLOR}
          strokeWidth={2.5}
          dot={{ r: 4, fill: HEIGHT_COLOR }}
          activeDot={{ r: 6, fill: "var(--color-header)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed,
  thin,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  /** Dünne Linie für Schätzungen, so dünn wie die Perzentile. */
  thin?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={color}
          strokeWidth={thin ? "1" : "2.5"}
          strokeDasharray={dashed ? "5 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
