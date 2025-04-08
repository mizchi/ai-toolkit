import { parseArgs } from "node:util";
import path from "node:path";
import { loadModelByName, selectModel } from "./model.ts";
import { trimLines } from "../core/utils.ts";
import { createMessenger, runTools } from "../core/mod.ts";
import { BUILTIN_TOOLS } from "../tools/mod.ts";
import $ from "@david/dax";
import type { Embedder } from "../core/types.ts";
import { embed, type Tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { PGlite } from "@electric-sql/pglite";
import { vector as pgVector } from "@electric-sql/pglite/vector";
import { searchMemoryTool, storageMemoryTool } from "../tools/memory.ts";
import { createPgliteBackend, initSchema } from "../backend/pglite.ts";

const gitRoot = await $`git rev-parse --show-toplevel`
  .stdout("piped")
  .noThrow()
  .text();

// 会話状態を保存するファイルパス
const SYSTEM = trimLines(`
あなたはユーザーの質問に答えるアシスタントです。
ユーザーの質問に答えるために、必要に応じてツールを使用してください。
URL のみを渡された場合、その URL の内容を読み取って、要約してください。

<environment>
  pwd: ${Deno.cwd()}
  gitRoot: ${gitRoot}
</environment>
`);

const embedder: Embedder = {
  embed: async (text: string) => {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-ada-002"),
      value: text,
    });
    return embedding;
  },
  dimensions: 1536,
};

async function loadBackend() {
  const DB_PATH = path.join(Deno.cwd(), "data");
  const pglite = new PGlite({
    extensions: { vector: pgVector },
    dataDir: DB_PATH,
  });
  await initSchema(pglite, embedder);
  const backend = createPgliteBackend(pglite, embedder);
  return {
    backend,
    memoryTools: {
      storageMemoryTool: storageMemoryTool(backend) as Tool,
      searchMemoryTool: searchMemoryTool(backend) as Tool,
    },
  };
}

export async function run(args: string[] = Deno.args): Promise<void> {
  const parsed = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      debug: { type: "boolean", short: "d" },
      modelName: { type: "string", short: "m" },
      maxSteps: { type: "string", short: "s" },
      maxTokens: { type: "string" },
      noBuiltin: { type: "boolean" },
      persist: { type: "string", short: "p" },
      oneshot: { type: "boolean", short: "o" },
      tools: { type: "string", short: "t", multiple: true },
    },
    allowPositionals: true,
  });
  const modelName = parsed.values.modelName ?? (await selectModel());
  const debug = parsed.values.debug ?? false;

  const { backend, memoryTools } = await loadBackend();

  const tools = {
    ...BUILTIN_TOOLS,
    ...memoryTools,
  };
  const messenger = createMessenger(backend);
  // TODO: persist id
  await messenger.load();

  // setup initial messages
  const firstMessage = parsed.positionals.join(" ");
  if (firstMessage) {
    await messenger.add({
      role: "user",
      content: firstMessage,
    });
  }

  if (debug) {
    console.log("[options]", parsed.values);
    console.log("[tools]", Object.keys(tools));
    console.log("[messsages]", messenger.get().length);
  }

  await runTools(
    {
      model: loadModelByName(modelName, {}),
      tools: tools,
      system: SYSTEM,
      maxSteps: parsed.values.maxSteps ? Number(parsed.values.maxSteps) : 100,
      maxTokens: parsed.values.maxTokens
        ? Number(parsed.values.maxTokens)
        : undefined,
      toolChoice: "auto",
    },
    {
      messenger: messenger,
      debug: debug,
      oneshot: parsed.values.oneshot,
    }
  );
}

if (import.meta.main) {
  await run();
}
