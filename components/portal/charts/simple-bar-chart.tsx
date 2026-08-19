export function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(0, ...data.map((item) => item.value));

  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((item) => {
        const heightPct = max === 0 ? 0 : (item.value / max) * 100;
        return (
          <div
            key={item.label}
            className="flex h-full flex-1 flex-col justify-end gap-2 text-center"
          >
            <span className="text-xs font-semibold tabular-nums">
              {item.value}
            </span>
            <div
              className="min-h-[4px] rounded-t-lg bg-primary/85 transition-all hover:bg-accent"
              style={{ height: `${heightPct}%` }}
            />
            <span className="truncate text-xs text-foreground/55">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
