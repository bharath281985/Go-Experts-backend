export const toTenDigitPhone = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(0, 10);
