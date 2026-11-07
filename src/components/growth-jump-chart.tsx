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
import type { JumpPoint } from "@/lib/growth/jump";
import { getSeriesColor } from "@/lib/series-colors";

const LINE_COLOR = getSeriesColor(0);
const WINDOW_COLOR = getSeriesColor(1);

/** Rund um den Gipfel stagniert die Sprungleistung oft (Adoleszenz-Ungeschicklichkeit). */
const PEAK_WINDOW_YEARS = 0.5;

type GrowthJumpChartProps = {
  points: JumpPoint[];
  /** Beobachteter Gipfel der Wachstumsgeschwindigkeit. */
  peakAge: number | null;
  /** Geschätzter Gipfel (Moore), nur wenn kein beobachteter vorliegt. */
  estimatedPeakAge: number | null;
};

const formatNumber = (value: number) => value.toFixed(1).replace(".", ",");

export function GrowthJumpChart({ points, peakAge, estimatedPeakAge }: GrowthJumpChartProps) {
  const markerAge = peakAge ?? estimatedPeakAge;
  const observed = peakAge !== null;

  const ages = points.map((point) => point.age);
  if (markerAge !== null) ages.push(markerAge - PEAK_WINDOW_YEARS, markerAge + PEAK_WINDOW_YEARS);
  const xMin = Math.floor(Math.min(...ages) - 0.25);
  const xMax = Math.ceil(Math.max(...ages) + 0.25);

  const heights = points.map((point) => point.jumpHeight);
  const yMin = Math.max(0, Math.floor((Math.min(...heights) - 5) / 5) * 5);
  const yMax = Math.ceil((Math.max(...heights) + 5) / 5) * 5;

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5" style={{ background: LINE_COLOR }} />
          Sprunghöhe
        </span>
        {markerAge !== null ? (
          <>
            <span className="flex items-center gap-2">
              <svg width="22" height="10" aria-hidden>
                <line
                  x1="11"
                  y1="0"
                  x2="11"
                  y2="10"
                  stroke="var(--color-foreground)"
                  strokeWidth="2"
                  strokeDasharray={observed ? undefined : "3 3"}
                />
              </svg>
              {observed ? "Wachstumsgipfel" : "Gipfel geschätzt (Moore)"}
            </span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: WINDOW_COLOR, opacity: 0.35 }}
              />
              ±½ Jahr um den Gipfel
            </span>
          </>
        ) : null}
      </div>

      <ComposedChart
        responsive
        width="100%"
        height={260}
        data={points}
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
          domain={[yMin, yMax]}
          tickLine={false}
          axisLine={false}
          width={50}
          label={{ value: "cm", angle: -90, position: "insideLeft" }}
        />

        {markerAge !== null ? (
          <>
            <ReferenceArea
              x1={markerAge - PEAK_WINDOW_YEARS}
              x2={markerAge + PEAK_WINDOW_YEARS}
              fill={WINDOW_COLOR}
              fillOpacity={0.12}
              stroke="none"
            />
            <ReferenceLine
              x={markerAge}
              stroke="var(--color-foreground)"
              strokeWidth={2}
              strokeDasharray={observed ? undefined : "4 4"}
              label={{
                value: `${observed ? "Gipfel" : "ca."} ${formatNumber(markerAge)} J.`,
                position: "insideTopRight",
                fill: "var(--color-foreground)",
                fontSize: 12,
              }}
            />
          </>
        ) : null}

        <Tooltip
          labelFormatter={(value) => `Alter ${formatNumber(Number(value))} J.`}
          formatter={(value) => [`${formatNumber(Number(value))} cm`, "Sprunghöhe"]}
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
          dataKey="jumpHeight"
          stroke={LINE_COLOR}
          strokeWidth={2.5}
          dot={{ r: 4, fill: LINE_COLOR, stroke: "none" }}
          activeDot={{ r: 5, fill: "var(--color-header)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </div>
  );
}
