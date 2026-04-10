export function estimateTrafficIndex(routeDurationMin, routeDistanceKm) {
  // Higher duration per km generally indicates heavier traffic.
  const minutesPerKm = routeDistanceKm > 0 ? routeDurationMin / routeDistanceKm : 0;
  const normalized = Math.min(1, Math.max(0, (minutesPerKm - 1.1) / 2.2));
  return Math.round(normalized * 100);
}
