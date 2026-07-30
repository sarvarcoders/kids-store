export function normalizePageSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => {
      const normalized = Array.isArray(value) ? value[0] : value;

      return [
        key,
        normalized === undefined || normalized.trim().length === 0
          ? undefined
          : normalized,
      ];
    }),
  );
}
