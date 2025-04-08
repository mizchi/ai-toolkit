import { parseArgs } from "node:util";
import path from "node:path";
import { loadModelByName } from "./model.ts";
import { trimLines } from "../core/utils.ts";
import {
  createMessenger,
  fsBackend,
  inMemoryBackend,
  runTools,
  StreamOptions,
} from "../core/mod.ts";
import { BUILTIN_TOOLS } from "../tools/mod.ts";

// 会話状態を保存するファイルパス
const SYSTEM = trimLines(`
あなたはユーザーの質問に答えるアシスタントです。
ユーザーの質問に答えるために、必要に応じてツールを使用してください。
URL のみを渡された場合、その URL の内容を読み取って、要約してください。

<environment>
  pwd: ${Deno.cwd()}
</environment>
`);

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
  const modelName = parsed.values.modelName ?? "claude-3-7-sonnet-20250219";
  const debug = parsed.values.debug ?? false;
  const tools = BUILTIN_TOOLS;

  const backend = parsed.values.persist
    ? fsBackend(path.resolve(Deno.cwd(), parsed.values.persist))
    : inMemoryBackend();
  const messenger = createMessenger(backend);
  const firstMessage = parsed.positionals.join(" ");
  if (firstMessage) {
    messenger.add({
      role: "user",
      content: firstMessage,
    });
  }

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
