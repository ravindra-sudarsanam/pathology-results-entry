interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 64,
  height = 20,
  color = '#1d4e89',
  ariaLabel,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 3;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y =
      max === min
        ? height / 2
        : height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastPoint = points[points.length - 1];

  return (
    <span className="sparkline-wrapper" title={ariaLabel ?? `Trend: ${data.join(' → ')}`}>
      <svg
        className="sparkline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? `Trend: ${data.join(' → ')}`}
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill={color} stroke="#ffffff" strokeWidth="1" />
      </svg>
    </span>
  );
}