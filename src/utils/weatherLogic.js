/**
 * Processes weather metrics and returns contextual insights.
 * @param {Object} data - The weather data object from our hook.
 * @returns {Array} insights - Array of objects with text and styling.
 */
export function generateInsights(data) {
  const insights = [];

  if (!data) return insights;

  // 1. Rheumatism / Joint Alert
  if (data.humidity > 85 && data.temp < 12) {
    insights.push({
      type: 'warning',
      text: 'High humidity and chill detected. Keep joints warm to prevent flare-ups.',
      style: 'bg-amber-500/10 border-amber-500/30 text-amber-200'
    });
  }

  // 2. Precipitation / Rain Alert (WMO codes 51-67 are various rains)
  const rainCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
  if (rainCodes.includes(data.weatherCode)) {
    insights.push({
      type: 'action',
      text: 'Precipitation active. Waterproof footwear and an umbrella are recommended.',
      style: 'bg-blue-500/10 border-blue-500/30 text-blue-200'
    });
  }

  // 3. UV Protection
  if (data.uvIndex >= 6) {
    insights.push({
      type: 'caution',
      text: 'Strong solar radiation. Apply SPF 30+ and wear sunglasses if outdoors.',
      style: 'bg-orange-500/10 border-orange-500/30 text-orange-200'
    });
  }

  // 4. Wind Alert
  if (data.windSpeed > 25) {
    insights.push({
      type: 'info',
      text: 'Brisk winds detected. A windbreaker or layered clothing is advised.',
      style: 'bg-teal-500/10 border-teal-500/30 text-teal-200'
    });
  }

  return insights;
}