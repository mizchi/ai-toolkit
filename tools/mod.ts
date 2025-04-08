import { Tool } from "../core/types.ts";
import { askTool } from "./ask.ts";
import { readFileTool, writeFileTool } from "./fs.ts";
import { readUrlTool } from "./web.ts";

export { bashTool } from "./bash.ts";
export { readUrlTool } from "./web.ts";
export { askTool } from "./ask.ts";
export { readFileTool, writeFileTool } from "./fs.ts";

export const BUILTIN_TOOLS: Record<string, Tool> = {
  askTool,
  readUrlTool,
  writeFileTool,
  readFileTool,
};
