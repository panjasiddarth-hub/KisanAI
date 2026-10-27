// Keep PATCH requests limited to fields the API explicitly lets users edit.
export function pickAllowedFields(payload, allowedFields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  const allowed = new Set(allowedFields);
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => allowed.has(key))
  );
}
