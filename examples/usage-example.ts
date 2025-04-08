import path from "node:path";
import { Tool } from "ai";
import { runTools } from "../core/mod.ts";
import { BUILTIN_TOOLS } from "../tools/mod.ts";
import { anthropic } from "@ai-sdk/anthropic";

async function loadTools(exprs: string[], cwd = Deno.cwd()) {
  const tools: Record<string, Tool> = {};
  for (const toolPath of exprs ?? []) {
    // from URL
    if (toolPath.startsWith("https://")) {
      const mod = await import(toolPath);
      tools[mod.toolName] = mod.default as Tool;
      continue;
    } else {
      // from local file
      const resolvedToolPath = path.join(cwd, toolPath);
      const mod = await import(resolvedToolPath);
      const baseName = path.basename(resolvedToolPath).replace(/\.tsx?$/, "");
      tools[baseName] = mod.default as Tool;
      console.log(`\n%c[tool-added] ${toolPath}`, "color: blue");
    }
  }
  return {
    ...tools,
    ...BUILTIN_TOOLS,
  };
}

const SYSTEM = `
あなたはユーザーの質問に答えるアシスタントです。
ユーザーの質問に答えるために、必要に応じてツールを使用してください。
URL のみを渡された場合、その URL の内容を読み取って、要約してください。

<environment>
  pwd: ${Deno.cwd()}
</environment>
`.trim();

if (import.meta.main) {
  const tools = await loadTools(Deno.args, Deno.cwd());
  const model = anthropic("claude-3-7-sonnet-20250219");
  await runTools({
    model: model,
    tools: tools,
    system: SYSTEM,
    maxSteps: 20,
    maxTokens: 4096,
    toolChoice: "auto",

    // first message
    prompt: "hello",
  });
}
