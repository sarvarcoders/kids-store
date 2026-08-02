import { z } from "zod";

const slugSourceSchema = z.string().max(500);
const slugMaximumSchema = z.number().int().min(1).max(200);

export function createCatalogSlug(
  valueInput: unknown,
  maximumInput: unknown = 200,
): string {
  const value = slugSourceSchema.parse(valueInput);
  const maximum = slugMaximumSchema.parse(maximumInput);

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’ʻʼ`']/g, "")
    .toLocaleLowerCase("uz")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximum)
    .replace(/-+$/g, "");
}

export function createCategorySlug(nameInput: unknown): string {
  return createCatalogSlug(nameInput, 160);
}

export function createProductSlug(input: {
  code: unknown;
  name: unknown;
}): string {
  const parsed = z
    .object({
      code: slugSourceSchema,
      name: slugSourceSchema,
    })
    .parse(input);

  return createCatalogSlug(`${parsed.name}-${parsed.code}`, 200);
}
