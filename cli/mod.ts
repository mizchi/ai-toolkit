import { parseArgs } from "node:util";
import path from "node:path";
import { loadModelByName, selectModel } from "./model.ts";
import { trimLines } from "../core/utils.ts";
import {
  createMessenger,
  fsBackend,
  inMemoryBackend,
  runTools,
  type StreamOptions,
} from "../core/mod.ts";
import { BUILTIN_TOOLS } from "../tools/mod.ts";
import $ from "@david/dax";
import type { Embedder } from "../core/types.ts";
import { embed, Tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { PGlite } from "@electric-sql/pglite";
import { vector as pgVector } from "@electric-sql/pglite/vector";
import { searchMemoryTool, storageMemoryTool } from "../tools/memory.ts";
import { createPgliteVectorStore } from "../vector_store/pglite.ts";
import { create } from "node:domain";

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

async function createMemoryTools(dataDir = path.join(Deno.cwd(), "data")) {
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
  const pglite = new PGlite({
    extensions: { vector: pgVector },
    dataDir: dataDir,
  });
  await pglite.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pglite.exec(/*sql*/ `
    CREATE TABLE IF NOT EXISTS doc (
      id SERIAL PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL,
      embedding vector(${embedder.dimensions})
    );
  `);

  const vectorStore = createPgliteVectorStore(pglite, embedder);
  return {
    storageMemoryTool: storageMemoryTool(vectorStore) as Tool,
    searchMemoryTool: searchMemoryTool(vectorStore) as Tool,
  } as const;
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
  const backend = parsed.values.persist
    ? fsBackend(path.join(Deno.cwd(), parsed.values.persist))
    : inMemoryBackend();
  const messenger = createMessenger(backend);
  const firstMessage = parsed.positionals.join(" ");
  if (firstMessage) {
    messenger.add({
      role: "user",
      content: firstMessage,
    });
  }

  const DB_PATH = path.join(Deno.cwd(), "data");

  const tools = {
    ...BUILTIN_TOOLS,
    ...(await createMemoryTools(DB_PATH)),
  };

  if (debug) {
    console.log("[options]", parsed.values);
    console.log("[tools]", Object.keys(tools));
    console.log("[messsages]", messenger.get().length);
  }

  const settings = {
    model: loadModelByName(modelName, {}),
    tools: tools,
    system: SYSTEM,
    maxSteps: parsed.values.maxSteps ? Number(parsed.values.maxSteps) : 100,
    maxTokens: parsed.values.maxTokens
      ? Number(parsed.values.maxTokens)
      : undefined,
    toolChoice: "auto",
  } satisfies StreamOptions;
  await runTools(settings, {
    messenger: messenger,
    debug: debug,
    oneshot: parsed.values.oneshot,
  });
}

if (import.meta.main) {
  await run();
}
