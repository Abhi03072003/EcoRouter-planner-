const MODE_CO2_PER_KM = {
  car: 120,
  bike: 70,
  ev: 35,
  walk: 0,
  cycle: 0,
  transit: 45
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function normalize(value, maxValue) {
  if (!maxValue || maxValue <= 0) {
    return 0;
  }
  return clamp(value / maxValue);
}

export function calculateCo2Grams(distanceKm, mode) {
  const factor = MODE_CO2_PER_KM[mode] ?? MODE_CO2_PER_KM.car;
  return Math.round(distanceKm * factor);
}

export function calculateEcoScore({
  distanceNorm,
  aqiNorm,
  trafficNorm,
  weatherNorm,
  co2Norm,
  weights
}) {
  const w = weights || {
    distance: 0.3,
    aqi: 0.25,
    traffic: 0.2,
    weather: 0.1,
    co2: 0.15
  };

  const penalty =
    w.distance * clamp(distanceNorm) +
    w.aqi * clamp(aqiNorm) +
    w.traffic * clamp(trafficNorm) +
    w.weather * clamp(weatherNorm) +
    w.co2 * clamp(co2Norm);

  const ecoScore = Math.round(100 * (1 - penalty));
  return Math.max(0, Math.min(100, ecoScore));
}

export function ecoCategory(ecoScore) {
  if (ecoScore >= 80) {
    return "Very Eco-Friendly";
  }
  if (ecoScore >= 60) {
    return "Eco-Friendly";
  }
  return "Not Eco-Friendly";
}
