const assert = require("node:assert/strict");
const test = require("node:test");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");

test("Tailwind generates escaped and stateful selectors with the patched parser", async () => {
  const result = await postcss([
    tailwindcss({
      content: [{ raw: '<div class="flex hover:bg-blue-500 md:w-1/2"></div>' }],
      corePlugins: { preflight: false },
    }),
  ]).process("@tailwind utilities;", { from: undefined });

  assert.match(result.css, /\.flex\s*\{\s*display: flex/);
  assert.ok(result.css.includes(".hover\\:bg-blue-500:hover"));
  assert.ok(result.css.includes(".md\\:w-1\\/2"));
  assert.match(result.css, /width: 50%/);
  assert.equal(result.warnings().length, 0);
});
