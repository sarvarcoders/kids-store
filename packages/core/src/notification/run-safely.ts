export async function runNotificationSafely(
  deliver: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<boolean> {
  try {
    await deliver();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
