import Link from "next/link";

export default function NavLink({
  href,
  children,
  icon = false,
}: {
  href: string;
  children: React.ReactNode;
  icon?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative ${
        icon ? "p-1.5 sm:px-3 sm:py-1.5" : "px-3 py-1.5"
      } text-sm font-medium text-slate-600 dark:text-gray-400 transition-all duration-200
      hover:text-slate-900 dark:hover:text-white
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-lg`}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
