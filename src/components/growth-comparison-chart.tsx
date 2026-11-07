import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "@/components/chart-legend";
import { NEUTRAL_REFERENCE_COLOR, referenceBandColors } from "@/lib/growth/colors";
import { bandKey, medianKey, sexLabels, type GrowthComparisonData } from "@/lib/growth/comparison";
import { getSeriesColor } from "@/lib/series-colors";
import type { GrowthSex } from "@/lib/types";

const formatAge = (age: number) => `${age.toFixed(1).replace(".", ",")} J.`;
const formatCm = (value: number) => `${value.toFixed(1).replace(".", ",")} cm`;

type GrowthComparisonChartProps = {
  data: GrowthComparisonData;
};

/**
 * Wachstumskurven mehrerer Personen übereinander, x-Achse = dezimales Alter.
 * Bei gemischten Geschlechtern bekommt jedes Geschlecht ein eigenes,
 * farbiges KiGGS-Band (siehe `referenceBandColors`); bei nur einem
 * Geschlecht bleibt das Band neutral wie im Einzel-Chart.
 */
export function GrowthComparisonChart({ data }: GrowthComparisonChartProps) {
  const { rows, series, sexes, xDomain, yDomain } = data;
  const mixed = sexes.length > 1;
  const bandColor = (sex: GrowthSex) =>
    mixed ? referenceBandColors[sex] : NEUTRAL_REFERENCE_COLOR;
  const bandOpacity = mixed ? 0.16 : 0.07;
  const nameByKey = Object.fromEntries(series.map((item) => [item.key, item.athlete.name]));
  const yTicks = Array.from(
    { length: (yDomain[1] - yDomain[0]) / 10 + 1 },
    (_, i) => yDomain[0] + i * 10,
  );

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
        {sexes.map((sex) => (
          <span key={sex} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded-sm"
              style={{
                background: bandColor(sex),
                opacity: mixed ? 0.5 : 0.12,
                outline: mixed ? `1px solid ${bandColor(sex)}` : undefined,
              }}
            />
            {mixed ? `KiGGS P3 bis P97 ${sexLabels[sex]}` : "KiGGS P3 bis P97"}
          </span>
        ))}
      </div>

      <ComposedChart
        responsive
        width="100%"
        height={420}
        data={rows}
        margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />

        <XAxis
          type="number"
          dataKey="age"
          domain={xDomain}
          allowDecimals={false}
          tickCount={Math.min(19, xDomain[1] - xDomain[0] + 1)}
          tickLine={false}
          label={{ value: "Alter (Jahre)", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          domain={yDomain}
          ticks={yTicks}
          tickLine={false}
          axisLine={false}
          width={60}
          unit=" cm"
        />

        {sexes.map((sex) => (
          <Area
            key={bandKey(sex)}
            type="monotone"
            dataKey={bandKey(sex)}
            // Bei gemischten Geschlechtern überlappen sich die Bänder stark –
            // farbige P3/P97-Kanten machen die Grenzen beider Bänder lesbar.
            stroke={mixed ? bandColor(sex) : "none"}
            strokeOpacity={0.55}
            strokeWidth={1}
            fill={bandColor(sex)}
            fillOpacity={bandOpacity}
            connectNulls
            tooltipType="none"
            activeDot={false}
            isAnimationActive={false}
          />
        ))}
        {sexes.map((sex) => (
          <Line
            key={medianKey(sex)}
            type="monotone"
            dataKey={medianKey(sex)}
            stroke={bandColor(sex)}
            strokeOpacity={mixed ? 0.6 : 0.3}
            strokeWidth={1}
            strokeDasharray="2 3"
            dot={false}
            activeDot={false}
            connectNulls
            tooltipType="none"
            isAnimationActive={false}
          />
        ))}

        <Tooltip
          labelFormatter={(value) => `Alter ${formatAge(Number(value))}`}
          formatter={(value, name) => [formatCm(Number(value)), nameByKey[String(name)] ?? name]}
          contentStyle={{
            backgroundColor: "var(--color-header)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
          }}
          labelStyle={{ color: "var(--color-sage)" }}
          itemStyle={{ color: "#fff" }}
        />

        {series.map(({ key, athlete }, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            connectNulls
            stroke={getSeriesColor(index)}
            strokeWidth={2.5}
            strokeDasharray={athlete.participant_type === "reference" ? "6 4" : undefined}
            dot={{ r: 3.5, fill: getSeriesColor(index) }}
            activeDot={{ r: 5.5, fill: "var(--color-header)" }}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>

      <ChartLegend
        series={series.map(({ athlete }) => ({
          id: athlete.id,
          label: mixed ? `${athlete.name} (${athlete.sex === "male" ? "m" : "w"})` : athlete.name,
          participantType: athlete.participant_type,
        }))}
      />
    </div>
  );
}
