// Shared configuration constants
export const SECRET_KEY = process.env.NEXT_PUBLIC_SECRET_KEY || "";

// Only show warning in development
if (!process.env.NEXT_PUBLIC_SECRET_KEY && process.env.NODE_ENV !== 'production') {
  console.warn(
    "NEXT_PUBLIC_SECRET_KEY is not defined in environment variables"
  );
}
