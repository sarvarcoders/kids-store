import type { CheckoutInput } from "@kids-store/shared/cart";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CheckoutDraft {
  deliveryAddress: string;
  idempotencyKey: string;
  phone: string;
}

type CheckoutDraftValidation =
  | { success: true; data: CheckoutInput }
  | { success: false };

function normalizeUzbekPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");

  if (/^\d{9}$/.test(compact)) {
    return `+998${compact}`;
  }

  if (/^998\d{9}$/.test(compact)) {
    return `+${compact}`;
  }

  return compact;
}

export function validateCheckoutDraft(
  input: CheckoutDraft,
): CheckoutDraftValidation {
  const phone = normalizeUzbekPhone(input.phone);
  const deliveryAddress = input.deliveryAddress.trim();

  if (
    !/^\+998\d{9}$/.test(phone) ||
    deliveryAddress.length < 5 ||
    deliveryAddress.length > 500 ||
    !UUID_PATTERN.test(input.idempotencyKey)
  ) {
    return { success: false };
  }

  return {
    success: true,
    data: {
      phone,
      deliveryAddress,
      idempotencyKey: input.idempotencyKey,
    },
  };
}
