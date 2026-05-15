import type { AlertType } from "@routecrafted/types";

export interface WeatherForecastDay {
  date: string; // YYYY-MM-DD
  weatherCode: number; // WMO code
  maxTempC: number;
  precipProbability: number;
}

// WMO weather interpretation codes → short human label
export function wmoLabel(code: number): string {
  if (code === 0) return "Clear sky ☀️";
  if (code <= 2) return "Partly cloudy ⛅";
  if (code === 3) return "Overcast 🌥";
  if (code <= 49) return "Foggy 🌫";
  if (code <= 57) return "Drizzle 🌦";
  if (code <= 67) return "Rain 🌧";
  if (code <= 77) return "Snow 🌨";
  if (code <= 82) return "Rain showers 🌧";
  if (code <= 86) return "Snow showers 🌨";
  if (code <= 94) return "Thunderstorm ⛈";
  if (code <= 99) return "Thunderstorm with hail ⛈";
  return "Severe weather ⚠";
}

// WMO weather interpretation codes → single emoji (compact calendar use)
export function wmoEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "🌥";
  if (code <= 49) return "🌫";
  if (code <= 57) return "🌦";
  if (code <= 67) return "🌧";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧";
  if (code <= 86) return "🌨";
  if (code <= 99) return "⛈";
  return "⚠️";
}

// Returns an alert if the code/temp is worth warning about, null otherwise
export function classifyAlert(
  code: number,
  maxTempC: number,
): { alertType: AlertType; label: string } | null {
  if (code >= 95)
    return { alertType: "storm", label: `Thunderstorm expected ⛈ — ${wmoLabel(code)}` };
  // WMO snow codes: 71-77 (snow fall) and 85-86 (snow showers)
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { alertType: "snow", label: `Snow expected ❄ — ${wmoLabel(code)}` };
  // WMO rain codes: 61-67 (rain) and 80-82 (rain showers)
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { alertType: "rain", label: `Rain expected 🌧 — ${wmoLabel(code)}` };
  if (maxTempC > 38)
    return { alertType: "extreme_heat", label: `Extreme heat 🥵 — ${Math.round(maxTempC)}°C` };
  return null;
}

// Fetch daily forecast for a date range from Open-Meteo (no API key needed)
export async function getForecast(
  lat: string | number,
  lon: string | number,
  startDate: string,
  endDate: string,
): Promise<WeatherForecastDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,precipitation_probability_max` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&timezone=UTC`;

  const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 h
  if (!res.ok) throw new Error(`Open-Meteo responded with ${res.status}`);

  const data = (await res.json()) as {
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      precipitation_probability_max: (number | null)[];
    };
  };

  if (!data.daily?.time?.length) return [];

  return data.daily.time.map((date, i) => ({
    date,
    weatherCode: data.daily!.weather_code[i] ?? 0,
    maxTempC: data.daily!.temperature_2m_max[i] ?? 20,
    precipProbability: data.daily!.precipitation_probability_max[i] ?? 0,
  }));
}
