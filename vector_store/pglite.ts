// https://orm.drizzle.team/docs/guides/vector-similarity-search
import { PGlite } from "npm:@electric-sql/pglite";
import { vector as pgVector } from "@electric-sql/pglite/vector";
import { index, integer, pgTable, vector, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { cosineDistance, sql, desc, gt } from "drizzle-orm";
import type { Embedder, VectorStore } from "../core/types.ts";

export const createPgliteVectorStore = (pglite: PGlite, embedder: Embedder) => {
  // schema
  const doc = pgTable(
    "doc",
    {
      id: integer().primaryKey().generatedAlwaysAsIdentity(),
      title: text("title"),
      content: text("content").notNull(),
      embedding: vector("embedding", { dimensions: embedder.dimensions }),
    },
    (table) => [
      index("embeddingIndex").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops")
      ),
    ]
  );
  const db = drizzle({
    client: pglite,
    schema: { doc },
  });
  return {
    insert: async (data: { title?: string; content: string }) => {
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
      return inserted.at(0)!.id;
    },
    async query(query, opts = {}) {
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
  } as VectorStore;
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

  const vectorStore = createPgliteVectorStore(pglite, embedder);
  // run
  const seedData = ["hello world", "green tea", "black"];
  for (const data of seedData) {
    await vectorStore.insert({
      content: data,
    });
  }
  // search
  const result = await vectorStore.query("black");
  console.log(result);
}
