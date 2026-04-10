export function computeProfileRating({ greenPoints, totalCo2Saved, trips }) {
  const tripBoost = Math.min(25, Math.round((trips || 0) * 1.5));
  const co2Boost = Math.min(35, Math.round((totalCo2Saved || 0) / 800));
  const pointsBoost = Math.min(40, Math.round((greenPoints || 0) / 12));
  const score = Math.max(0, Math.min(100, tripBoost + co2Boost + pointsBoost));

  let label = "Starter";
  if (score >= 80) label = "Eco Champion";
  else if (score >= 60) label = "Green Pro";
  else if (score >= 40) label = "Eco Explorer";

  return { score, label };
}
