export function Progress({
  value,
  color = "#d9654f",
}: {
  value: number;
  color?: string;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e9e4dc]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${normalized}%`, backgroundColor: color }}
      />
    </div>
  );
}
