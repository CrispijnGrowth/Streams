interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "default";
  muted?: boolean;
}

export function ProgressBar({ value, showLabel = true, size = "default", muted = false }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const height = size === "sm" ? "h-1" : "h-2";
  const fillColor = muted ? "bg-muted-foreground/40" : "bg-primary";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} rounded-full bg-muted overflow-hidden`}>
        <div
          className={`${height} rounded-full ${fillColor} transition-all duration-500 ease-out`}
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="progress-bar-fill"
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono tabular-nums text-muted-foreground min-w-[3ch]" data-testid="progress-value">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
