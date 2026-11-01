import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthSex } from "@/lib/types";
import { PHV_TIMING_THRESHOLDS } from "@/lib/growth/timing";
import type { PeakResult, VelocityPoint } from "@/lib/growth/velocity";
import { getSeriesColor } from "@/lib/series-colors";

const BAND_COLORS = {
  early: getSeriesColor(4),
  average: getSeriesColor(1),
  late: getSeriesColor(3),
};
const LINE_COLOR = getSeriesColor(0);

/** Unterhalb dieses Alters dominiert das Säuglings-/Kleinkindwachstum die Skala. */
const MIN_DISPLAY_AGE = 6;

type GrowthVelocityChartProps = {
  velocity: VelocityPoint[];
  sex: GrowthSex;
  peak: PeakResult;
};

const formatNumber = (value: number) => value.toFixed(1).replace(".", ",");

export function GrowthVelocityChart({ velocity, sex, peak }: GrowthVelocityChartProps) {
  const data = velocity
    .filter((point) => point.age >= MIN_DISPLAY_AGE)
    .map((point) => ({ age: point.age, velocity: point.velocity, smoothed: point.smoothed }));

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-card-border bg-card text-sm text-foreground/60">
        Mindestens drei Messungen ab 6 Jahren nötig.
      </div>
    );
  }

  const { early, late } = PHV_TIMING_THRESHOLDS[sex];
  const xMin = Math.floor(Math.min(data[0].age, early - 1));
  const xMax = Math.ceil(Math.max(data[data.length - 1].age, late + 1));
  const yMax = Math.ceil(Math.max(...data.map((point) => point.velocity), 10) + 1);

  const bands = [
    { key: "early", label: "früh", x1: xMin, x2: early },
    { key: "average", label: "normal", x1: early, x2: late },
    { key: "late", label: "spät", x1: late, x2: xMax },
  ] as const;

  const markerAge = peak.age;

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5" style={{ background: LINE_COLOR }} />
          Wachstumsrate (geglättet)
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: LINE_COLOR, opacity: 0.5 }}
          />
          je Messintervall
        </span>
        {bands.map((band) => (
          <span key={band.key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: BAND_COLORS[band.key], opacity: 0.35 }}
            />
            Gipfel {band.label}
          </span>
        ))}
      </div>

      <ComposedChart
        responsive
        width="100%"
        height={300}
        data={data}
        margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />

        <XAxis
          type="number"
          dataKey="age"
          domain={[xMin, xMax]}
          allowDecimals={false}
          tickCount={xMax - xMin + 1}
          tickLine={false}
          label={{ value: "Alter (Jahre)", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          domain={[0, yMax]}
          tickLine={false}
          axisLine={false}
          width={50}
          label={{ value: "cm/Jahr", angle: -90, position: "insideLeft" }}
        />

        {bands.map((band) => (
          <ReferenceArea
            key={band.key}
            x1={band.x1}
            x2={band.x2}
            fill={BAND_COLORS[band.key]}
            fillOpacity={0.12}
            stroke="none"
          />
        ))}

        {markerAge !== null ? (
          <ReferenceLine
            x={markerAge}
            stroke="var(--color-foreground)"
            strokeWidth={2}
            label={{
              value: `Gipfel ${formatNumber(markerAge)} J.`,
              position: "insideTopRight",
              fill: "var(--color-foreground)",
              fontSize: 12,
            }}
          />
        ) : null}

        <Tooltip
          labelFormatter={(value) => `Alter ${formatNumber(Number(value))} J.`}
          formatter={(value, name) => [
            `${formatNumber(Number(value))} cm/Jahr`,
            name === "smoothed" ? "geglättet" : "Messintervall",
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

        <Line
          type="linear"
          dataKey="velocity"
          stroke="none"
          dot={{ r: 3.5, fill: LINE_COLOR, fillOpacity: 0.5, stroke: "none" }}
          activeDot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="smoothed"
          stroke={LINE_COLOR}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "var(--color-header)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </div>
  );
}
