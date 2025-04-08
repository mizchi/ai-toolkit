import type { TextStreamPart, Tool, ToolResult } from "npm:ai";
import { truncate } from "../core/utils.ts";
import { Runtime } from "../core/types.ts";

export function handleStreamTextPart(
  part: TextStreamPart<Record<string, Tool>>,
  runtime: Runtime,
  debug: boolean = false
) {
  if (part.type === "text-delta") {
    runtime.write(part.textDelta); // 画面に表示
    return;
  }
  if (part.type === "tool-call") {
    console.log(
      `%c[tool-call:${part.toolName}] ${truncate(part.args)}`,
      "color: blue"
    );
    // @ts-ignore no-type
  } else if (part.type === "tool-result") {
    const toolResult = part as ToolResult<string, unknown, unknown>;
    console.log(
      `%c[tool-result:${toolResult.toolName}]\n${truncate(toolResult.result)}`,
      "color: green"
    );
  } else if (debug) {
    console.log(
      `%c[debug:${part.type}] ${truncate(part, 512)}`,
      "color: gray;"
    );
  }
}
