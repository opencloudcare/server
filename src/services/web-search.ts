import {tavily} from "@tavily/core";
import {InferenceClient} from "@huggingface/inference";
import db from "../utils/db";

const tvly = tavily({apiKey: process.env.TAVILY_API_KEY});
const hf = new InferenceClient(process.env.HF_API_KEY);

const SIMILARITY_THRESHOLD = 0.85;
const EMBEDDING_MODEL = "ibm-granite/granite-embedding-97m-multilingual-r2";

const embedQuery = async (text: string): Promise<number[]> => {
  const result = await hf.featureExtraction({
    model: EMBEDDING_MODEL,
    inputs: text,
    provider: "hf-inference",
  });
  return result as number[];
};

export const searchWeb = async (searchQuery: string, liveSearch = false): Promise<string | null> => {
  const embedding = await embedQuery(searchQuery);
  const embeddingLiteral = `[${embedding.join(",")}]`;

  const cached = await db.query(
    `SELECT results, 1 - (embedding <=> $1::vector) AS similarity
     FROM web_search
     WHERE 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [embeddingLiteral, SIMILARITY_THRESHOLD]
  );

  if (cached.rows.length > 0) {
    console.log("WEB SEARCH CACHE HIT:", searchQuery, "similarity:", cached.rows[0].similarity);
    return cached.rows[0].results;
  }

  if (!liveSearch) return null;

  const searchResponse = await tvly.search(searchQuery, {maxResults: 5});
  const searchContext = searchResponse.results
    .map((r: any) => `**${r.title}**\n${r.content}\nSource: ${r.url}`)
    .join("\n\n---\n\n");

  await db.query(
    "INSERT INTO web_search (query, results, embedding) VALUES ($1, $2, $3::vector)",
    [searchQuery, searchContext, embeddingLiteral]
  );

  console.log("WEB SEARCH CACHE MISS:", searchQuery);
  return searchContext;
};
