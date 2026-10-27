export function annotateCalendarSupport(result, cropNames) {
  if (!Array.isArray(result?.recommendations)) return result;

  const supportedCrops = new Set(
    cropNames.map((name) => String(name).trim().toLowerCase()),
  );

  return {
    ...result,
    recommendations: result.recommendations.map((recommendation) => ({
      ...recommendation,
      calendarSupported: supportedCrops.has(String(recommendation?.crop || '').trim().toLowerCase()),
    })),
  };
}
