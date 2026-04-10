import { fetchJson } from "../lib/fetcher.js";

const AQI_SCALE = { 1: 40, 2: 80, 3: 120, 4: 180, 5: 240 };

export function mapWeatherToRisk(condition, tempC) {
  const code = (condition || "").toLowerCase();
  let risk = 20;

  if (code.includes("rain") || code.includes("drizzle") || code.includes("thunder")) {
    risk += 28;
  }
  if (code.includes("fog") || code.includes("mist") || code.includes("haze")) {
    risk += 22;
  }
  if (tempC >= 38) {
    risk += 16;
  }
  if (tempC <= 5) {
    risk += 10;
  }

  return Math.min(100, risk);
}

function aqiIndexToValue(aqiIdx) {
  return AQI_SCALE[aqiIdx] ?? 100;
}

function estimateCarbonRateGPerKm({ aqi, weatherRisk, trafficIndex }) {
  // Approximate city-level carbon pressure index for car travel.
  const base = 120;
  const trafficImpact = 1 + trafficIndex / 140;
  const aqiImpact = 1 + aqi / 700;
  const weatherImpact = 1 + weatherRisk / 450;
  return Math.round(base * trafficImpact * aqiImpact * weatherImpact);
}

export async function fetchEnvironmentalFactors(lat, lon) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return {
      avgAqi: 90,
      weatherRisk: 25,
      weather: { condition: "clear", tempC: 28 }
    };
  }

  const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`;
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;

  try {
    const [air, weather] = await Promise.all([
      fetchJson(airUrl, { timeoutMs: 8000, retries: 1 }),
      fetchJson(weatherUrl, { timeoutMs: 8000, retries: 1 })
    ]);

    const aqiIdx = air?.list?.[0]?.main?.aqi ?? 2;
    const avgAqi = aqiIndexToValue(aqiIdx);

    const condition = weather?.weather?.[0]?.main || "clear";
    const tempC = Number(weather?.main?.temp ?? 28);

    return {
      avgAqi,
      weatherRisk: mapWeatherToRisk(condition, tempC),
      weather: {
        condition,
        tempC
      }
    };
  } catch {
    return {
      avgAqi: 90,
      weatherRisk: 25,
      weather: { condition: "clear", tempC: 28 }
    };
  }
}

export async function fetchEnvironmentalSnapshot(lat, lon) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    const current = {
      timestamp: new Date().toISOString(),
      aqi: 90,
      tempC: 28,
      condition: "clear",
      weatherRisk: 25,
      trafficIndex: 55,
      carbonRateGPerKm: estimateCarbonRateGPerKm({ aqi: 90, weatherRisk: 25, trafficIndex: 55 })
    };

    const forecast = [1, 2, 3].map((h) => ({
      hourOffset: h,
      timestamp: new Date(Date.now() + h * 60 * 60 * 1000).toISOString(),
      aqi: 90 + h * 3,
      tempC: 28 + h * 0.4,
      condition: "clear",
      weatherRisk: 25 + h,
      trafficIndex: 55 + h * 3,
      carbonRateGPerKm: estimateCarbonRateGPerKm({
        aqi: 90 + h * 3,
        weatherRisk: 25 + h,
        trafficIndex: 55 + h * 3
      })
    }));

    return { current, forecast, source: "fallback" };
  }

  let airNow;
  let weatherNow;
  let airForecast;
  let weatherForecast;

  try {
    [airNow, weatherNow, airForecast, weatherForecast] = await Promise.all([
      fetchJson(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`, {
        timeoutMs: 8000,
        retries: 1
      }),
      fetchJson(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`,
        { timeoutMs: 8000, retries: 1 }
      ),
      fetchJson(
        `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${lat}&lon=${lon}&appid=${key}`,
        { timeoutMs: 8000, retries: 1 }
      ),
      fetchJson(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric`,
        { timeoutMs: 8000, retries: 1 }
      )
    ]);
  } catch {
    return fetchEnvironmentalSnapshotFallback();
  }

  const currentAqi = aqiIndexToValue(airNow?.list?.[0]?.main?.aqi ?? 2);
  const currentTemp = Number(weatherNow?.main?.temp ?? 28);
  const currentCondition = weatherNow?.weather?.[0]?.main || "clear";
  const currentWeatherRisk = mapWeatherToRisk(currentCondition, currentTemp);
  const currentTraffic = Math.min(95, Math.max(20, Math.round(35 + currentAqi / 5 + currentWeatherRisk / 7)));

  const current = {
    timestamp: new Date().toISOString(),
    aqi: currentAqi,
    tempC: currentTemp,
    condition: currentCondition,
    weatherRisk: currentWeatherRisk,
    trafficIndex: currentTraffic,
    carbonRateGPerKm: estimateCarbonRateGPerKm({
      aqi: currentAqi,
      weatherRisk: currentWeatherRisk,
      trafficIndex: currentTraffic
    })
  };

  const airList = airForecast?.list || [];
  const weatherList = weatherForecast?.list || [];
  const forecast = [1, 2, 3].map((idx) => {
    const air = airList[idx] || airList[0] || null;
    const weather = weatherList[idx] || weatherList[0] || null;
    const aqi = aqiIndexToValue(air?.main?.aqi ?? 2);
    const tempC = Number(weather?.main?.temp ?? currentTemp);
    const condition = weather?.weather?.[0]?.main || currentCondition;
    const weatherRisk = mapWeatherToRisk(condition, tempC);
    const trafficIndex = Math.min(95, Math.max(20, Math.round(35 + aqi / 5 + weatherRisk / 7 + idx * 2)));

    return {
      hourOffset: idx,
      timestamp: new Date(Date.now() + idx * 60 * 60 * 1000).toISOString(),
      aqi,
      tempC,
      condition,
      weatherRisk,
      trafficIndex,
      carbonRateGPerKm: estimateCarbonRateGPerKm({ aqi, weatherRisk, trafficIndex })
    };
  });

  return { current, forecast, source: "openweather" };
}

function fetchEnvironmentalSnapshotFallback() {
  const current = {
    timestamp: new Date().toISOString(),
    aqi: 90,
    tempC: 28,
    condition: "clear",
    weatherRisk: 25,
    trafficIndex: 55,
    carbonRateGPerKm: estimateCarbonRateGPerKm({ aqi: 90, weatherRisk: 25, trafficIndex: 55 })
  };

  const forecast = [1, 2, 3].map((h) => ({
    hourOffset: h,
    timestamp: new Date(Date.now() + h * 60 * 60 * 1000).toISOString(),
    aqi: 90 + h * 3,
    tempC: 28 + h * 0.4,
    condition: "clear",
    weatherRisk: 25 + h,
    trafficIndex: 55 + h * 3,
    carbonRateGPerKm: estimateCarbonRateGPerKm({
      aqi: 90 + h * 3,
      weatherRisk: 25 + h,
      trafficIndex: 55 + h * 3
    })
  }));

  return { current, forecast, source: "fallback" };
}
