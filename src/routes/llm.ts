import {Router} from "express";
import {askModel} from "../services/llm";
import db from "../utils/db";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";

const router = Router();

router.post("/ask", async (req, res) => {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");


  const {contents, conversationId} = req.body;

  try {
    await db.query("INSERT INTO message (conversation_id, role, content) VALUES ($1, $2, $3)", [conversationId, contents[contents.length - 1].role, contents[contents.length - 1].content]);
    let output = ""
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

router.post("/conversations", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)}); // check for session
  if (!session) {
    res.status(401).send("No such session");
    return;
  } // no session

  const {conversationId, contents} = req.body;

  try {
    await db.query("INSERT INTO conversation (id, user_id, title) VALUES ($1, $2, $3)", [conversationId, session.user.id, contents[contents.length - 1].content]);
    res.status(201).send("ok");
  } catch (error) {
    console.error(error)
    res.status(500).send("Error creating new conversation");
  }
})


export default router;