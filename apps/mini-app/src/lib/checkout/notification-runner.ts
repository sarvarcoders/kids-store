export async function runNotificationSafely(
  notification: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<void> {
  try {
    await notification();
  } catch (error) {
    onError(error);
  }
}
