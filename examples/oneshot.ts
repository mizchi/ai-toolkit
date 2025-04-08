/**
 * No local dependency chat example with ai-sdk
 */
import {
  streamText,
  tool,
  jsonSchema,
  ToolResult,
  Tool,
  type CoreMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { deepseek } from "@ai-sdk/deepseek";
import { parseArgs } from "node:util";
import { extract, toMarkdown } from "@mizchi/readability";
import path from "node:path";

async function runCommand(
  command: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  const [cmd, ...args] = command.split(/\s+/g);
  const c = new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, code } = await c.output();
  const decoder = new TextDecoder();
  return {
    code,
    stdout: decoder.decode(stdout),
    stderr: decoder.decode(stderr),
  };
}

// 会話状態を保存するファイルパス
const SYSTEM = `
あなたはユーザーの質問に答えるアシスタントです。
ユーザーの質問に答えるために、必要に応じてツールを使用してください。
URL のみを渡された場合、その URL の内容を読み取って、要約してください。
<environment>
  pwd: ${Deno.cwd()}
</environment>
`
  .split("\n")
  .map((line) => line.trim())
  .join("\n");

// getModelByName 関数をここに定義
export function getModelByName<
  T extends
    | Parameters<typeof anthropic>[0]
    | Parameters<typeof google>[0]
    | Parameters<typeof deepseek>[0]
>(model: T, settings?: any) {
  if (model === "claude") {
    return anthropic("claude-3-7-sonnet-20250219", settings);
  }
  if (model === "gemini") {
    return google("gemini-2.5-pro-exp-03-25", settings);
  }
  if (model === "deepseek") {
    return deepseek("deepseek-chat", settings);
  }
  if (model.startsWith("claude-")) {
    return anthropic(model, settings);
  }
  if (model.startsWith("gemini-")) {
    return google(model, settings);
  }
  if (model.startsWith("deepseek-")) {
    return deepseek(model, settings);
  }
  throw new Error(`Model ${model} not supported`);
}

/// Tools
export const bashTool = tool({
  description: `
  bash コマンドの実行をユーザーに提案します。
  ユーザーはコマンドを確認してからコマンドの実行を行います。拒否されることがあります。
  `.trim(),
  parameters: jsonSchema<{ command: string }>({
    type: "object",
    properties: {
      command: {
        type: "string",
        describe: "The command to execute",
      },
      cwd: {
        type: "string",
        describe: "Current Working Directory",
      },
    },
    required: ["command", "cwd"],
  }),
  async execute({ command }) {
    const ok = confirm(`Run: ${command}`);
    if (!ok) {
      return `User denied.`;
    }
    try {
      const result = await runCommand(command);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return message;
    }
  },
});

export const askTool = tool({
  description: "Ask a question to the user. Call this for user input",
  parameters: jsonSchema<{ question: string }>({
    type: "object",
    properties: {
      question: {
        type: "string",
        describe: "The question to ask the user",
      },
    },
    required: ["question"],
  }),
  async execute({ question }) {
    console.log(`\n%c[ask] ${question}`, "color: green");
    const ret = prompt(">") ?? "no answer";
    if (!ret.trim()) Deno.exit(1);
    console.log(`\n%c[response] ${ret}`, "color: gray");
    return ret;
  },
});

export const readUrlTool = tool({
  description: "Read a URL and extract the text content",
  parameters: jsonSchema<{ url: string }>({
    type: "object",
    properties: {
      url: {
        type: "string",
        describe: "The URL to read",
      },
    },
    required: ["url"],
  }),
  async execute({ url }) {
    const res = await fetch(url).then((res) => res.text());
    const extracted = extract(res);
    return toMarkdown(extracted.root);
  },
});

export const readFileTool = tool({
  description: "Read an absolute file path and extract the text content",
  parameters: jsonSchema<{ filepath: string }>({
    type: "object",
    properties: {
      filepath: {
        type: "string",
        describe: "The absolute file path to read",
      },
    },
    required: ["filepath"],
  }),
  async execute({ filepath }) {
    if (!path.isAbsolute(filepath)) {
      return `Denied: filepath is not absolute path`;
    }
    const res = await Deno.readTextFile(filepath);
    return res;
  },
});

export const writeFileTool = tool({
  description: "Write text content to an absolute file path. User checks it",
  parameters: jsonSchema<{ filepath: string; content: string }>({
    type: "object",
    properties: {
      filepath: {
        type: "string",
        describe: "The absolute file path to write",
      },
      content: {
        type: "string",
        describe: "The content to write to the file",
      },
    },
    required: ["filepath", "content"],
  }),
  async execute({ filepath, content }) {
    if (!path.isAbsolute(filepath)) {
      return `Denied: filepath is not absolute path`;
    }
    const ok = confirm(
      `Write ${filepath}(${content.length})\n${truncate(content)}\n`
    );
    if (!ok) return `User denied`;
    await Deno.writeTextFile(filepath, content);
    return "ok";
  },
});

const BUILTIN_TOOLS: Record<string, Tool> = {
  askTool,
  bashTool,
  readUrlTool,
  readFileTool,
  writeFileTool,
};

/// utils
function truncate(input: unknown, length: number = 100) {
  const str =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);
  return str.length > length ? str.slice(0, length) + "..." : str;
}
const write = (text: string) => {
  Deno.stdout.write(new TextEncoder().encode(text));
};

async function loadMessages(filepath: string): Promise<CoreMessage[]> {
  try {
    const _ = await Deno.stat(filepath);
    const content = await Deno.readTextFile(filepath);
    return JSON.parse(content);
  } catch (_e) {
    return [];
  }
}

async function loadExternalTools(exprs: string[], cwd = Deno.cwd()) {
  const tools: Record<string, Tool> = {};
  for (const toolPath of exprs ?? []) {
    // from URL
    if (toolPath.startsWith("https://")) {
      const mod = await import(toolPath);
      tools[mod.toolName] = mod.default as Tool;
      continue;
    }
    // from local file
    const resolvedToolPath = path.join(cwd, toolPath);
    const mod = await import(resolvedToolPath);
    const baseName = path.basename(resolvedToolPath).replace(/\.tsx?$/, "");
    tools[baseName] = mod.default as Tool;
    console.log(`\n%c[tool-added] ${toolPath}`, "color: blue");
  }
  return tools;
}

/// Run
if (import.meta.main) {
  const parsed = parseArgs({
    args: Deno.args,
    options: {
      input: { type: "string", short: "i" },
      debug: { type: "boolean", short: "d" },
      modelName: { type: "string", short: "m" },
      maxSteps: { type: "string", short: "s" },
      maxTokens: { type: "string" },
      noBuiltin: { type: "boolean" },
      persist: { type: "string", short: "p" },
      tools: { type: "string", short: "t", multiple: true },
    },
    allowPositionals: true,
  });
  const modelName = parsed.values.modelName ?? "claude-3-7-sonnet-20250219";
  const debug = parsed.values.debug ?? false;
  const externals = parsed.values.tools
    ? loadExternalTools(parsed.values.tools, Deno.cwd())
    : {};
  const usingTools: Record<string, Tool> = parsed.values.noBuiltin
    ? externals
    : {
        ...BUILTIN_TOOLS,
        ...externals,
      };
  let messages: CoreMessage[] = [];
  let writeMessages: (() => Promise<void>) | undefined = undefined;
  if (parsed.values.persist) {
    const outpath = path.join(Deno.cwd(), parsed.values.persist);
    messages = await loadMessages(outpath);
    writeMessages = async () => {
      await Deno.writeTextFile(outpath, JSON.stringify(messages, null, 2));
    };
    Deno.addSignalListener("SIGINT", async () => {
      try {
        await writeMessages?.();
      } finally {
        Deno.exit(0);
      }
    });
  }

  const firstPrompt = parsed.positionals.join(" ");
  if (firstPrompt) {
    messages.push({
      role: "user",
      content: firstPrompt,
    });
  }

  if (debug) {
    console.log("[options]", parsed.values);
    console.log("[tools]", Object.keys(usingTools));
    console.log("[messsages]", messages.length);
  }

  const model = getModelByName(modelName, {});
  while (true) {
    if (messages.length > 0) {
      const stream = streamText({
        model,
        tools: usingTools,
        system: SYSTEM,
        messages: messages,
        maxSteps: parsed.values.maxSteps ? Number(parsed.values.maxSteps) : 100,
        maxTokens: parsed.values.maxTokens
          ? Number(parsed.values.maxTokens)
          : undefined,
        toolChoice: "auto",
      });
      for await (const part of stream.fullStream) {
        if (part.type === "text-delta") {
          write(part.textDelta); // 画面に表示
          continue;
        }
        if (part.type === "tool-call") {
          console.log(
            `%c[tool-call:${part.toolName}] ${truncate(part.args)}`,
            "color: blue"
          );
          // @ts-ignore no-type
        } else if (part.type === "tool-result") {
          const toolResult = part as ToolResult<string, any, any>;
          console.log(
            `%c[tool-result:${toolResult.toolName}]\n${truncate(
              toolResult.result
            )}`,
            "color: green"
          );
        } else if (debug) {
          console.log(
            `%c[debug:${part.type}] ${truncate(part, 512)}`,
            "color: gray;"
          );
        }
      }
      const response = await stream.response;
      messages.push(...response.messages);
      await writeMessages?.();
      write("\n\n");
    }
    // Next input
    const nextInput = prompt(">");
    if (!nextInput || nextInput.trim() === "") {
      Deno.exit(0);
    }
    messages.push({ role: "user", content: nextInput });
  }
}
