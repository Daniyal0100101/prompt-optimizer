export default function SkipToContentLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-blue-600 focus:text-white"
    >
      Skip to content
    </a>
  );
}
