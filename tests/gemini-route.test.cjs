const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

let providerResponse;
let providerRequest;

class MockGoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async (request) => {
        providerRequest = request;
        return providerResponse;
      },
    };
  }
}

const originalLoad = Module._load;
const originalTsExtension = require.extensions[".ts"];
const originalConsoleError = console.error;
require.extensions[".ts"] = (module, filename) => {
  const source = require("node:fs").readFileSync(filename, "utf8");
  module._compile(
    ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    }),
    filename
  );
};
Module._load = function (request, parent, isMain) {
  if (request === "next/server") {
    return {
      NextResponse: {
        json: (body, init = {}) => ({ status: init.status ?? 200, body }),
      },
    };
  }
  if (request === "@google/genai") {
    return {
      FinishReason: { MAX_TOKENS: "MAX_TOKENS" },
      GoogleGenAI: MockGoogleGenAI,
      ThinkingLevel: { LOW: "LOW" },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { POST } = require("../app/api/gemini/route.ts");
Module._load = originalLoad;
if (originalTsExtension) require.extensions[".ts"] = originalTsExtension;
else delete require.extensions[".ts"];
console.error = () => {};

test.after(() => {
  console.error = originalConsoleError;
});

test.beforeEach(() => {
  providerResponse = undefined;
  providerRequest = undefined;
});

async function post(body, response) {
  providerResponse = response;
  return POST({ json: async () => body });
}

const validOptimization = () => ({
  text: JSON.stringify({
    optimizedPrompt: "A clear, improved prompt.",
    explanations: ["Improves clarity."],
    suggestions: [],
  }),
  candidates: [{ finishReason: "STOP" }],
});

const baseBody = {
  apiKey: "test-only-key",
  model: "gemini-3.8-flash",
  prompt: "Improve this prompt.",
};

test("uses low thinking and an adequate output budget for optimization", async () => {
  const response = await post(baseBody, validOptimization());

  assert.equal(response.status, 200);
  assert.equal(response.body.optimizedPrompt, "A clear, improved prompt.");
  assert.equal(providerRequest.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(providerRequest.config.maxOutputTokens, 8192);
});

test("uses a bounded output budget for clarification", async () => {
  const response = await post(
    {
      ...baseBody,
      task: "clarify",
      selectedSuggestion: "Add a target audience.",
    },
    { text: JSON.stringify({ questions: ["Who is the audience?"] }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.questions, ["Who is the audience?"]);
  assert.equal(providerRequest.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(providerRequest.config.maxOutputTokens, 4096);
});

test("returns 502 instead of success when provider text is absent or blank", async (t) => {
  for (const [label, text] of [["missing", undefined], ["blank", "  \n  "]]) {
    await t.test(label, async () => {
      const response = await post(baseBody, { text, candidates: [{ finishReason: "STOP" }] });
      assert.equal(response.status, 502);
      assert.match(response.body.error, /incomplete response/i);
    });
  }
});

test("returns 502 for structured output with an empty optimized prompt", async () => {
  const response = await post(baseBody, {
    text: JSON.stringify({ optimizedPrompt: "   ", explanations: [] }),
    candidates: [{ finishReason: "STOP" }],
  });

  assert.equal(response.status, 502);
  assert.match(response.body.error, /incomplete response/i);
});

test("returns 502 for output truncated at the token limit", async () => {
  const response = await post(baseBody, {
    text: '{"optimizedPrompt":"partial',
    candidates: [{ finishReason: "MAX_TOKENS" }],
  });

  assert.equal(response.status, 502);
  assert.match(response.body.error, /incomplete response/i);
});
