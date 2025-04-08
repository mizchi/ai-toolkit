import { jsonSchema, tool } from "ai";
import { trimLines } from "../core/utils.ts";
import type { VectorStore } from "../core/types.ts";

export const storageMemoryTool = (vectorStore: VectorStore) =>
  tool({
    description: trimLines(`
      指定された内容をメモリを保存します。
    `),
    parameters: jsonSchema<{ title: string; content: string }>({
      type: "object",
      properties: {
        title: {
          type: "string",
          describe: "The title of the memory entry",
        },
        content: {
          type: "string",
          describe: "The content of the memory",
        },
      },
      required: ["title", "content"],
    }),
    async execute({ title, content }) {
      await vectorStore.insertMemory({
        title: title,
        content: content,
      });
    },
  });

export const searchMemoryTool = (vectorStore: VectorStore) =>
  tool({
    description: trimLines(`
      storageMemoryTool で記憶したメモリを検索します。
    `),
    parameters: jsonSchema<{ query: string; threshold?: number }>({
      type: "object",
      properties: {
        query: {
          type: "string",
          describe: "The query to search for in memory",
        },
        threshold: {
          type: "number",
          describe: "The threshold for similarity search. 0~1",
        },
      },
      required: ["query"],
    }),
    async execute({ query, threshold }) {
      const result = await vectorStore.queryMemory(query, {
        threshold,
      });
      if (result.length === 0) {
        return "No memory found";
      }
      return result.map((r) => ({
        id: r.id,
        similarity: r.similarity,
        content: r.content,
        title: r.title,
      }));
    },
  });
