// https://orm.drizzle.team/docs/guides/vector-similarity-search
import { PGlite } from "npm:@electric-sql/pglite";
import { vector as pgVector } from "@electric-sql/pglite/vector";
import {
  index,
  integer,
  pgTable,
  vector,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { openai } from "@ai-sdk/openai";
import { type CoreMessage, embed } from "ai";
import { cosineDistance, sql, desc, gt, eq, asc } from "drizzle-orm";
import type { Embedder, MemoryableStorageBackend } from "../core/types.ts";

const doc = pgTable(
  "doc",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: text("title"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

const chat = pgTable("chat", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
const message = pgTable(
  "message",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    chatId: integer("chat_id").notNull(), // foreign key
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chatIdIndex").on(table.chatId),
    index("createdAtIndex").on(table.createdAt),
  ]
);

const schema = {
  doc,
  chat,
  message,
};

export async function initSchema(pglite: PGlite, embedder: Embedder) {
  await pglite.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  await pglite.exec(/*sql*/ `
    CREATE TABLE IF NOT EXISTS doc (
      id SERIAL PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL,
      embedding vector(${embedder.dimensions})
    );
  `);
  await pglite.exec(/*sql*/ `
    CREATE TABLE IF NOT EXISTS chat (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pglite.exec(/*sql*/ `
    CREATE TABLE IF NOT EXISTS message (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      FOREIGN KEY (chat_id) REFERENCES chat(id)
    );
  `);
}

export const createPgliteBackend = (pglite: PGlite, embedder: Embedder) => {
  const db = drizzle(pglite);
  let _currentChatId: number | undefined = undefined;
  return {
    async loadMessages(id) {
      if (!id) {
        const chatId = await db.insert(chat).values({}).returning({
          id: chat.id,
        });
        _currentChatId = chatId.at(0)!.id;
        return [];
      }
      _currentChatId = parseInt(id);
      const existedChat = await db
        .select()
        .from(chat)
        .where(eq(chat.id, _currentChatId));

      // if chat not found, create a new one
      if (existedChat.length === 0) {
        const chatId = await db.insert(chat).values({}).returning({
          id: chat.id,
        });
        return chatId.at(0)!.id;
      }
      // load
      const rows = await db
        .select()
        .from(message)
        .where(eq(message.chatId, _currentChatId))
        .orderBy(asc(message.createdAt));
      return rows.map((row) => ({
        role: row.role,
        content: JSON.parse(row.content),
      })) as CoreMessage[];
    },
    async addMessage(...messages) {
      for (const message of messages) {
        await db.insert(schema.message).values({
          chatId: _currentChatId!,
          role: message.role,
          content: JSON.stringify(message.content),
        });
      }
    },
    insertMemory: async (data) => {
      const embedding = await embedder.embed(data.content);
      const inserted = await db
        .insert(doc)
        .values({
          title: data.title,
          content: data.content,
          embedding,
        })
        .returning({
          id: doc.id,
        });
      return;
      // return inserted.at(0)!.id;
    },
    async queryMemory(query, opts = {}) {
      const embedding = await embedder.embed(query);
      const similarity = sql<number>`1 - (${cosineDistance(
        doc.embedding,
        embedding
      )})`;
      return db
        .select({
          id: doc.id,
          similarity,
          content: doc.content,
        })
        .from(doc)
        .where(gt(similarity, opts.threshold ?? 0.7))
        .orderBy((t) => desc(t.similarity))
        .limit(opts.limit ?? 5);
    },
  } as MemoryableStorageBackend;
};

if (import.meta.main) {
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
    // dataDir: "./data",
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

  const vectorStore = createPgliteBackend(pglite, embedder);
  // run
  const seedData = ["hello world", "green tea", "black"];
  for (const data of seedData) {
    await vectorStore.insertMemory({
      content: data,
    });
  }
  // search
  const result = await vectorStore.queryMemory?.("black");
  console.log(result);
}
