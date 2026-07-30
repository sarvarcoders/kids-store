export function searchParamsToObject(
  searchParams: URLSearchParams,
): Record<string, string> {
  return Object.fromEntries(
    Array.from(searchParams.entries()).filter(
      ([, value]) => value.trim().length > 0,
    ),
  );
}
