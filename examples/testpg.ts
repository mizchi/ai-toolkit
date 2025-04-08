// https://orm.drizzle.team/docs/guides/vector-similarity-search
import { PGlite } from "@electric-sql/pglite";
import { vector as pgVector } from "@electric-sql/pglite/vector";
import { index, integer, pgTable, vector, text } from "drizzle-orm/pg-core";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import { cosineDistance, sql, desc, gt } from "drizzle-orm";

// openai embedding
async function generateEmbedding(value: string) {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-ada-002"),
    value,
  });
  return embedding;
}

// schema
export const doc = pgTable(
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
const schema = {
  doc,
};

type DB = PgliteDatabase<typeof schema>;

async function createDoc(
  db: DB,
  data: {
    title?: string;
    content: string;
  }
) {
  const embedding = await generateEmbedding(data.content);
  await db.insert(doc).values({
    title: data.title,
    content: data.content,
    embedding,
  });
}

async function searchDocBySimilarity(
  db: DB,
  text: string,
  opts: {
    threshold?: number;
    limit?: number;
  }
) {
  const embedding = await generateEmbedding(text);
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
}

async function initDb(): Promise<DB> {
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
      embedding vector(1536)
    );
  `);
  const db = drizzle({
    client: pglite,
    schema: schema,
  });
  return db;
}

const db = await initDb();
// run
const seedData = ["hello world", "green tea", "black"];
for (const data of seedData) {
  await createDoc(db, {
    content: data,
  });
}

// search
const result = await searchDocBySimilarity(db, "black", {
  threshold: 0.7,
  limit: 5,
});
console.log(result);
