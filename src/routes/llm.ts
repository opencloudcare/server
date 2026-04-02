import {Router} from "express";
import {askModel, generateConversationTitle} from "../services/llm";
import db from "../utils/db";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";

const router = Router();

// Endpoint for communication with the LLM
router.post("/ask", async (req, res) => {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  const {contents, conversationId} = req.body;

  try {
    await db.query("INSERT INTO message (conversation_id, role, content) VALUES ($1, $2, $3)", [conversationId, contents[contents.length - 1].role, contents[contents.length - 1].content]);
    let output = "" // buffer for a output stream
    const stream = await askModel(req.body.contents, req.body.searchWeb)
    for await (const chunk of stream) {
      res.write(chunk.text ?? "")
      output += chunk.text
    }
    await db.query("INSERT INTO message (conversation_id, role, content) VALUES ($1, $2, $3)", [conversationId, "model", output]);
    res.end()
  } catch (error: any) {
    console.error(error)
    const status = error?.status === 429 ? 429 : 500
    if (!res.headersSent) {
      res.status(status).end()
    } else {
      res.end()
    }
  }

})

// Endpoint for initial conversation title
router.post("/get-chat-title", async (req, res) => {
  const {contents} = req.body;
  try {
    const response = await generateConversationTitle(contents);
    res.status(200).send(response.text);
  } catch (error) {
    console.error(error)
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
  const {conversationId, contents} = req.body;

  try {
    await db.query("INSERT INTO conversation (id, user_id, title) VALUES ($1, $2, $3)", [conversationId, session.user.id, "New Chat"]);
    res.status(201).send("ok");
  } catch (error) {
    console.error(error)
    res.status(500).send("Error creating new conversation");
  }
})

// Endpoint to get the messages from a specific conversation
router.get("/conversations/:id", async (req, res) => {
  const {id} = req.params;

  try {
    const data = await db.query("SELECT * FROM message WHERE conversation_id = $1 ORDER BY created_at", [id]);
    res.status(200).send({data: data.rows});
  } catch (error) {
    console.error(error)
    res.status(500).send("Error getting conversation messages");
  }

})

router.post("/conversations/:id/title", async (req, res) => {
  try {
    await db.query("UPDATE conversation SET title = $1 WHERE id = $2", [req.body.title, req.params.id])
    res.status(200).send("ok");
  } catch (error) {
    console.error(error)
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
  try {
    const data = await db.query("SELECT id, title FROM conversation WHERE user_id = $1", [session.user.id]);
    res.status(200).send({data: data.rows});
  } catch (error) {
    console.error(error)
    res.status(500).send("Error getting conversations");
  }
})


export default router;