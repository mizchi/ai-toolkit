import path from "node:path";
import { jsonSchema, tool } from "npm:ai";
import { truncate } from "../core/utils.ts";

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
