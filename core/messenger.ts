import type { CoreMessage, Messenger } from "./types.ts";
import { DatabaseSync, DatabaseSyncOptions } from "node:sqlite";

type Backend = {
  load: () => Promise<CoreMessage[]>;
  save: (messages: CoreMessage[]) => Promise<void>;
};

// just syntax highlighting
const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return strings
    .map((str, i) => str + (values[i] ? ` ${values[i]}` : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
};

// WIP
export function sqliteBackend(dbPath: string, opts: DatabaseSyncOptions = {}) {
  const db = new DatabaseSync(dbPath, opts);
  db.exec(sql`
    CREATE TABLE IF NOT EXISTS chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);
  db.exec(sql`
    CREATE TABLE IF NOT EXISTS message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chat(id)
    )
  `);
  let currentChatId: number | undefined = undefined;
  let _messages: CoreMessage[] = [];
  const backend = {
    async init(id: string) {
      // ensure
      const ret = db
        .prepare(
          sql`
          SELECT id FROM chat WHERE id = ?
        `
        )
        .get(id) as { id: number } | undefined;
      if (ret) {
        currentChatId = ret.id;
        const rows = db
          .prepare(
            sql`
            SELECT * FROM message WHERE chat_id = ? ORDER BY created_at ASC
          `
          )
          .all(id) as { role: string; content: string }[];
        _messages = rows.map((row) => ({
          role: row.role,
          content: JSON.parse(row.content),
        })) as CoreMessage[];
      } else {
        const newChat = db
          .prepare(
            sql`
            INSERT INTO chat DEFAULT VALUES
          `
          )
          .get() as { id: number };
        currentChatId = newChat.id;
        _messages = [];
      }
    },
    load: async () => {
      return _messages;
    },
    save: async (messages: CoreMessage[]) => {
      if (currentChatId === undefined) {
        throw new Error("Chat ID is not set");
      }
      const insert = db.prepare(
        sql`
          INSERT INTO message (chat_id, role, content)
          VALUES (?, ?, ?)
        `
      );
      for (const message of messages) {
        insert.run(
          currentChatId,
          message.role,
          JSON.stringify(message.content)
        );
      }
    },
  };
  return backend satisfies Backend;
}

export function inMemoryBackend(): Backend {
  return {
    load: async () => [],
    save: async () => {},
  };
}

export function fsBackend(savePath: string): Backend {
  return {
    load: async () => {
      try {
        const _ = await Deno.stat(savePath);
        const content = await Deno.readTextFile(savePath);
        return JSON.parse(content) as CoreMessage[];
      } catch (_e) {
        return [];
      }
    },
    save: async (messages: CoreMessage[]) => {
      try {
        await Deno.writeTextFile(savePath, JSON.stringify(messages, null, 2));
      } catch (e) {
        console.error("Failed to save messages:", e);
      }
    },
  };
}

export function createMessenger(
  backend: Backend = inMemoryBackend(),
  opts: {
    saveOnChange?: boolean;
  } = {}
): Messenger {
  let _messages: CoreMessage[] = [];
  return {
    get(): CoreMessage[] {
      return Array.from(_messages);
    },
    async load(): Promise<CoreMessage[]> {
      _messages = await backend.load();
      return _messages;
    },
    async reset() {
      _messages.length = 0;
      if (opts.saveOnChange) {
        await backend.save(_messages);
      }
    },
    async add(...messages: CoreMessage[]) {
      _messages.push(...messages);
      if (opts.saveOnChange) {
        await backend.save(_messages);
      }
    },
    async save(): Promise<void> {
      _messages = await backend.load();
    },
  };
}
