import { StorageBackend } from "../core/types.ts";

export function fsBackend(savePath: string): StorageBackend {
  return {
    async load(id) {
      if (!id) {
        return [];
      }
      try {
        const _ = await Deno.stat(savePath);
        const content = await Deno.readTextFile(savePath);
        return JSON.parse(content);
      } catch (_e) {
        return [];
      }
    },
    async add(...messages) {
      try {
        await Deno.writeTextFile(savePath, JSON.stringify(messages, null, 2));
      } catch (e) {
        console.error("Failed to save messages:", e);
      }
    },
  };
}
