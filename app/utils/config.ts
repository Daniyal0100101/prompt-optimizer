// Shared configuration constants
export const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY ?? "";
export const HAS_SECRET_KEY = SECRET_KEY.trim().length > 0;

if (!HAS_SECRET_KEY && process.env.NODE_ENV !== "production") {
  console.warn(
    "NEXT_PUBLIC_SECRET_KEY is not defined. API key storage is disabled until it is configured."
  );
}
