// Shared configuration constants
export const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY || "";

if (!process.env.NEXT_PUBLIC_SECRET_KEY) {
  console.warn(
    "NEXT_PUBLIC_SECRET_KEY is not defined in environment variables"
  );
}
