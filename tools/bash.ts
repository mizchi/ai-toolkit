import { jsonSchema, tool } from "ai";
import { trimLines } from "../core/utils.ts";

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

export const bashTool = tool({
  description: trimLines(`
  bash コマンドの実行をユーザーに提案します。
  ユーザーはコマンドを確認してからコマンドの実行を行います。拒否されることがあります。
  `),
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
