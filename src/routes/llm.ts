import {Router} from "express";
import {askModel, generateConversationTitle} from "../services/llm";
import db from "../utils/db";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";
import {getRawFile} from "../services/storage-bucket";
import {lookup} from "mime-types";

const router = Router();
const LOG = "\x1b[36m[LLM]\x1b[0m";

// Endpoint for communication with the LLM
router.post("/ask", async (req, res) => {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    console.warn(`${LOG} /ask | unauthorized request`);
    res.status(401).send("User not authenticated");
    return;
  }
  const {contents, model = "gemma-4-31b-it", conversationId, files} = req.body;
  console.log(`${LOG} /ask | user: ${session.user.id} | model: ${model} | conv: ${conversationId} | files: ${files?.length ?? 0} | web_search: ${!!req.body.searchWeb}`);

  const fileList: {mimeType: string, data: string}[] = []

  try {
    for (const file of files) {
      const bytes = await getRawFile(file.fullKey)
      fileList.push({
        mimeType: lookup(file.name) || 'application/octet-stream', // lookup returns a mimetype depending on the file extension
        data: bytes.toString('base64')
      });
    }
  } catch (error) {
    console.error(`${LOG} /ask | failed to fetch file | conv: ${conversationId}`, error);
    res.status(500).json({error: "Problem sending the file"});
    return;
  }

  try {
    const response = await db.query("INSERT INTO message (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id", [conversationId, contents[contents.length - 1].role, contents[contents.length - 1].content]);
    for (const file of files) {
      await db.query("INSERT INTO message_file (message_id, file_key, file_name, file_type) VALUES ($1, $2, $3, $4)", [response.rows[0].id, file.fullKey, file.name, file.fileType])
    }
    let output = "" // buffer for an output stream
    const start = Date.now();
    const stream = await askModel(req.body.contents, model, req.body.searchWeb, fileList)
    for await (const chunk of stream) {
      res.write(chunk.text ?? "")
      output += chunk.text ?? ""
    }
    console.log(`${LOG} /ask | stream complete | conv: ${conversationId} | ${output.length} chars | ${((Date.now() - start) / 1000).toFixed(1)}s`);
    await db.query("INSERT INTO message (conversation_id, role, content) VALUES ($1, $2, $3)", [conversationId, "model", output]);
    res.end()
  } catch (error: any) {
    const status = error?.status === 429 ? 429 : 500;
    console.error(`${LOG} /ask | error | conv: ${conversationId} | status: ${status}`, error)
    if (!res.headersSent) {
      res.status(status).end()
    } else {
      res.end()
    }
  }

})

// Endpoint for initial conversation title
router.post("/get-chat-title", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    res.status(401).send("User not authenticated");
    return;
  }
  const {contents} = req.body;
  console.log(`${LOG} /get-chat-title | user: ${session.user.id}`);

  try {
    const response = await generateConversationTitle(contents);
    console.log(`${LOG} /get-chat-title | generated: "${response.text}" | user: ${session.user.id}`);
    res.status(200).send(response.text);
  } catch (error) {
    console.error(`${LOG} /get-chat-title | error | user: ${session.user.id}`, error)
    res.status(500).json({error: error})
  }
})

// Endpoint for new conversation creation (triggered by new message)
router.post("/conversations", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    res.status(401).send("User not authenticated");
    return;
  }
  const {conversationId} = req.body;
  console.log(`${LOG} /conversations POST | user: ${session.user.id} | conv: ${conversationId}`);

  try {
    await db.query("INSERT INTO conversation (id, user_id, title) VALUES ($1, $2, $3)", [conversationId, session.user.id, "New Chat"]);
    res.status(201).send("ok");
  } catch (error) {
    console.error(`${LOG} /conversations POST | error creating conversation | user: ${session.user.id} | conv: ${conversationId}`, error)
    res.status(500).send("Error creating new conversation");
  }
})

// Endpoint to get the messages from a specific conversation
router.get("/conversations/:id", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    res.status(401).send("User not authenticated");
    return;
  }
  const {id} = req.params;
  console.log(`${LOG} /conversations/:id GET | user: ${session.user.id} | conv: ${id}`);

  try {
    const data = await db.query(`SELECT m.id,
                                        m.role,
                                        m.content,
                                        m.created_at,
                                        json_agg(
                                        json_build_object('fullKey', mf.file_key, 'name', mf.file_name,
                                                          'fileType', mf.file_type)
                                                ) FILTER ( WHERE mf.file_key IS NOT NULL) AS files
                                 FROM message AS m
                                          JOIN conversation AS c ON c.id = m.conversation_id
                                          LEFT JOIN message_file AS mf ON mf.message_id = m.id
                                 WHERE m.conversation_id = $1
                                   AND c.user_id = $2
                                 GROUP BY m.id, m.role, m.content, m.created_at
                                 ORDER BY m.created_at`, [id, session.user.id]);
    console.log(`${LOG} /conversations/:id GET | returned ${data.rows.length} messages | conv: ${id}`);
    res.status(200).send({data: data.rows});
  } catch (error) {
    console.error(`${LOG} /conversations/:id GET | error | conv: ${id}`, error)
    res.status(500).send("Error getting conversation messages");
  }

})

// Endpoint to save the new generated title to conversation
router.post("/conversations/:id/title", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    res.status(401).send("User not authenticated");
    return;
  }
  console.log(`${LOG} /conversations/:id/title POST | user: ${session.user.id} | conv: ${req.params.id} | title: "${req.body.title}"`);

  try {
    await db.query("UPDATE conversation SET title = $1 WHERE id = $2", [req.body.title, req.params.id])
    res.status(200).send("ok");
  } catch (error) {
    console.error(`${LOG} /conversations/:id/title POST | error | conv: ${req.params.id}`, error)
    res.status(500).send("Error updating conversation title");
  }
})

// Endpoint to get all the users conversations
router.get("/conversations", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) { // no session
    res.status(401).send("User not authenticated");
    return;
  }
  console.log(`${LOG} /conversations GET | user: ${session.user.id}`);

  try {
    const data = await db.query("SELECT id, title FROM conversation WHERE user_id = $1", [session.user.id]);
    console.log(`${LOG} /conversations GET | returned ${data.rows.length} conversations | user: ${session.user.id}`);
    res.status(200).send({data: data.rows});
  } catch (error) {
    console.error(`${LOG} /conversations GET | error | user: ${session.user.id}`, error)
    res.status(500).send("Error getting conversations");
  }
})


export default router;
