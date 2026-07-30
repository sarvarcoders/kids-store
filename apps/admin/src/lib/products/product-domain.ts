import { z } from "zod";

const variantReferenceSchema = z.object({
  cartItems: z.number().int().nonnegative(),
  orderItems: z.number().int().nonnegative(),
});

export function getRemovedVariantStrategy(
  referencesInput: unknown,
): "delete" | "zero_stock" {
  const references = variantReferenceSchema.parse(referencesInput);

  return references.cartItems > 0 || references.orderItems > 0
    ? "zero_stock"
    : "delete";
}

export function getProductActivationChange(
  currentInput: unknown,
  nextInput: unknown,
): {
  action: "product_archived" | "product_reactivated" | null;
  changed: boolean;
} {
  const current = z.boolean().parse(currentInput);
  const next = z.boolean().parse(nextInput);

  return current === next
    ? { action: null, changed: false }
    : {
        action: next ? "product_reactivated" : "product_archived",
        changed: true,
      };
}

export function isPrismaUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
