export function estimatePopulationMetrics({ cityTraffic = 55, aqi = 90 }) {
  const aroundAreaPopulation = Math.round(18000 + cityTraffic * 420 + aqi * 40);
  const roadPopulation = Math.round(300 + cityTraffic * 12 + aqi * 2.6);

  const carbonPercent = Math.min(100, Math.round((aqi / 300) * 45 + (cityTraffic / 100) * 55));
  const increase30MinPct = Math.round(2 + carbonPercent * 0.09);
  const decrease30MinPct = Math.round(1 + (100 - carbonPercent) * 0.05);

  return {
    aroundAreaPopulation,
    roadPopulation,
    carbonPercent,
    projection30Min: {
      increasePct: increase30MinPct,
      decreasePct: decrease30MinPct
    }
  };
}
