"use client";

import { useEffect, useMemo, useState } from "react";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function DynamicGraph({ baseAqi = 80, baseCarbon = 150 }) {
  const [points, setPoints] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({ t: i, aqi: baseAqi, carbon: baseCarbon }))
  );
  const [hover, setHover] = useState(null);

  useEffect(() => {
    setPoints((prev) => prev.map((p) => ({ ...p, aqi: baseAqi, carbon: baseCarbon })));
  }, [baseAqi, baseCarbon]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const next = {
          t: last.t + 1,
          aqi: clamp(Math.round(last.aqi + (Math.random() * 10 - 5)), 20, 320),
          carbon: clamp(Math.round(last.carbon + (Math.random() * 14 - 7)), 40, 360)
        };
        return [...prev.slice(1), next];
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const width = 460;
  const height = 180;

  const pathData = useMemo(() => {
    const toPath = (series, maxValue) =>
      series
        .map((p, i) => {
          const x = (i / (series.length - 1)) * width;
          const y = height - (p / maxValue) * (height - 12);
          return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");

    return {
      aqiPath: toPath(points.map((p) => p.aqi), 320),
      carbonPath: toPath(points.map((p) => p.carbon), 360)
    };
  }, [points]);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((x / rect.width) * (points.length - 1))));
    setHover({ idx, x });
  };

  const hoverPoint = hover ? points[hover.idx] : null;

  return (
    <div className="graph-box">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Live AQI and carbon trend"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={pathData.aqiPath} className="graph-line-aqi" />
        <path d={pathData.carbonPath} className="graph-line-carbon" />
        {hover && (
          <line
            x1={(hover.idx / (points.length - 1)) * width}
            x2={(hover.idx / (points.length - 1)) * width}
            y1="0"
            y2={height}
            stroke="#8b5a00"
            strokeDasharray="4 5"
          />
        )}
      </svg>
      {hoverPoint && (
        <div className="graph-tooltip">
          <strong>t-{points.length - 1 - hover.idx}s</strong>
          <span>AQI: {hoverPoint.aqi}</span>
          <span>Carbon: {hoverPoint.carbon} g/km</span>
        </div>
      )}
      <div className="graph-legend">
        <span><i className="aqi-dot" /> AQI trend</span>
        <span><i className="carbon-dot" /> Carbon trend</span>
      </div>
    </div>
  );
}
