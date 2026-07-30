const completedMutations = new Map<
  string,
  { expiresAt: number; value: unknown }
>();
const pendingMutations = new Map<string, Promise<unknown>>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1_000;

export async function runIdempotentMutation<T>(
  scope: string,
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const storageKey = `${scope}:${key}`;
  const now = Date.now();
  const completed = completedMutations.get(storageKey);

  if (completed && completed.expiresAt > now) {
    return completed.value as T;
  }

  const pending = pendingMutations.get(storageKey);

  if (pending) {
    return pending as Promise<T>;
  }

  const operationPromise = operation()
    .then((value) => {
      completedMutations.set(storageKey, {
        expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      pendingMutations.delete(storageKey);
    });

  pendingMutations.set(storageKey, operationPromise);
  return operationPromise;
}
