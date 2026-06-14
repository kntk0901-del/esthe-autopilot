"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export function SalesTrendChart({
  data,
}: {
  data: Array<{ date: string; sales: number }>;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 800, height: 260 }}
      >
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9654f" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#d9654f" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e6e1d8" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#777d78" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#777d78" }}
            tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #ded9cf",
              background: "#fffdf9",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#d9654f"
            strokeWidth={2.5}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
