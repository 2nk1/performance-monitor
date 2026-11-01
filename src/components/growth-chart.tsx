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
import type { GrowthPoint, Prediction } from "@/lib/growth/analysis";
import { referenceCurve } from "@/lib/growth/percentiles";
import type { ProjectionPoint } from "@/lib/growth/projection";
import type { GrowthSex } from "@/lib/types";
import { predictionColors } from "@/lib/growth/colors";
import { getSeriesColor } from "@/lib/series-colors";

const HEIGHT_COLOR = getSeriesColor(0);

type GrowthChartProps = {
  points: GrowthPoint[];
  predictions: Prediction[];
  projection: ProjectionPoint[] | null;
  sex: GrowthSex;
};

const formatAge = (age: number) => `${age.toFixed(1).replace(".", ",")} J.`;
const formatCm = (value: number) => `${value.toFixed(1).replace(".", ",")} cm`;

export function GrowthChart({ points, predictions, projection, sex }: GrowthChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-card-border bg-card text-sm text-foreground/60">
        Noch keine Messungen vorhanden.
      </div>
    );
  }

  const latest = points[points.length - 1];
  const available = predictions.filter(
    (prediction): prediction is Prediction & { value: number } => prediction.value !== null,
  );

  const xMin = Math.floor(points[0].age) - 0.5;
  const xMax = Math.max(
    18.5,
    Math.ceil(latest.age) + 1,
    Math.ceil(projection?.at(-1)?.age ?? 0) + 0.5,
  );

  const reference = referenceCurve(sex, xMin, xMax);

  const yValues = [
    ...reference.flatMap((point) => [point.p3, point.p97]),
    ...points.map((point) => point.height_cm),
    ...points.flatMap((point) => (point.khamisRoche !== null ? [point.khamisRoche] : [])),
    ...(projection?.map((point) => point.height) ?? []),
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
    projected?: number;
    /** KiGGS-Referenz: Bereich P3 bis P97 und Median. */
    band?: [number, number];
    median?: number;
  };

  const data: Row[] = points.map((point, index) => ({
    age: point.age,
    height: point.height_cm,
    khamisRoche: point.khamisRoche,
    // Die Fortschreibung beginnt an der letzten Messung, damit die Linie anschließt.
    ...(projection && index === points.length - 1 ? { projected: point.height_cm } : {}),
  }));

  projection?.slice(1).forEach((point) => data.push({ age: point.age, projected: point.height }));

  reference.forEach((point) =>
    data.push({ age: point.age, band: [point.p3, point.p97], median: point.p50 }),
  );
  data.sort((a, b) => a.age - b.age);
  const hasKrHistory = points.some((point) => point.khamisRoche !== null);

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
        {projection ? <LegendItem color={HEIGHT_COLOR} label="Fortschreibung" dashed /> : null}
        {available.map((prediction) => (
          <LegendItem
            key={prediction.id}
            color={predictionColors[prediction.id]}
            label={`Zielgröße ${prediction.label}: ${formatCm(prediction.value)}`}
            dashed
          />
        ))}
      </div>

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

        {available.map((prediction) =>
          prediction.range ? (
            <ReferenceArea
              key={`${prediction.id}-area`}
              x1={latest.age}
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
          labelFormatter={(value) => `Alter ${formatAge(Number(value))}`}
          formatter={(value, name) => [
            formatCm(Number(value)),
            name === "height"
              ? "Größe"
              : name === "projected"
                ? "Fortschreibung"
                : "Khamis-Roche-Prognose",
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

        {projection ? (
          <Line
            type="linear"
            dataKey="projected"
            stroke={HEIGHT_COLOR}
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
        ) : null}

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

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={dashed ? "5 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}
