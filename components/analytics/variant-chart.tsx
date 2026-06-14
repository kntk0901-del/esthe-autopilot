"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function VariantChart({
  data,
}: {
  data: Array<{ name: string; clicks: number; reservations: number }>;
}) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 800, height: 300 }}
      >
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e6e1d8" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#6e746f" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#6e746f" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #ded9cf",
              background: "#fffdf9",
              fontSize: 12,
            }}
          />
          <Bar dataKey="clicks" name="クリック" fill="#d9654f" radius={[5, 5, 0, 0]} />
          <Bar
            dataKey="reservations"
            name="予約"
            fill="#2f7d6d"
            radius={[5, 5, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
