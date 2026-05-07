import {Router} from "express";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";
import {getHiddenData, saveHiddenData, updateEmail} from "../services/user-actions";
import db from "../utils/db";


const router = Router()
const LOG = "\x1b[32m[User]\x1b[0m";

router.post("/update/email", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  console.log(`${LOG} /update/email | user: ${session.user.id}`);

  try {
    const response = await db.query('SELECT "providerId" FROM account WHERE "userId" = $1', [session.user.id])
    const onlyCredential = response.rows.length === 1 && response.rows[0].providerId === "credential"
    if (!onlyCredential) {
      console.log(`${LOG} /update/email | blocked — user has OAuth connection | user: ${session.user.id}`);
      res.status(403).send("Cannot change email connected to OAuth")
      return
    }
    await updateEmail(session.user.email, req.body.email)
    console.log(`${LOG} /update/email | success | user: ${session.user.id}`);
    res.status(200).send("ok")

  } catch (error) {
    console.error(`${LOG} /update/email | error | user: ${session.user.id}`, error instanceof Error ? error.message : "Internal Server Error")
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.get("/ai_preferences", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  console.log(`${LOG} /ai_preferences GET | user: ${session.user.id}`);
  try {
    const result = await db.query('SELECT ai_model, enable_web_search_default, detailed_responses FROM user_preferences WHERE user_id = $1 LIMIT 1', [session.user.id])
    res.status(200).json({data: result.rows[0]})

  } catch (error) {
    console.error(`${LOG} /ai_preferences GET | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.post("/ai_preferences", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  const {ai_model, enable_web_search_default, detailed_responses} = req.body
  console.log(`${LOG} /ai_preferences POST | user: ${session.user.id} | model: ${ai_model} | web_search: ${enable_web_search_default} | detailed: ${detailed_responses}`);
  try {
    const response = await db.query(
      `UPDATE user_preferences SET ai_model = $1, enable_web_search_default = $2, detailed_responses = $3 WHERE user_id = $4 RETURNING ai_model, enable_web_search_default, detailed_responses`,
      [ai_model, enable_web_search_default, detailed_responses, session.user.id]
    )
    res.status(200).json({data: response.rows[0]})

  } catch (error) {
    console.error(`${LOG} /ai_preferences POST | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.delete("/conversations/all", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  console.log(`${LOG} /conversations/all DELETE | user: ${session.user.id}`);
  const result = await db.query("DELETE FROM conversation WHERE user_id = $1", [session.user.id])
  console.log(`${LOG} /conversations/all DELETE | deleted ${result.rowCount} conversation(s) | user: ${session.user.id}`);
  res.status(200).json({deleted: result.rowCount})
})

router.get("/connections/:id", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  console.log(`${LOG} /connections GET | user: ${session.user.id} | queried id: ${req.params.id}`);
  try {
    const result = await db.query('SELECT "providerId" FROM account WHERE "userId" = $1', [req.params.id])
    console.log(`${LOG} /connections GET | found ${result.rows.length} connection(s) | user: ${session.user.id}`);
    res.status(200).json({data: result.rows})

  } catch (error) {
    console.error(`${LOG} /connections GET | error | user: ${session.user.id}`, error instanceof Error ? error.message : "Internal Server Error")
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})


router.get("/hidden-data", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  console.log(`${LOG} /hidden-data GET | user: ${session.user.id}`);
  try {
    const result = await getHiddenData(session.user.id)
    console.log(`${LOG} /hidden-data GET | returned ${result?.length ?? 0} term(s) | user: ${session.user.id}`);
    res.status(200).json({data: result})
  } catch (error) {
    console.error(`${LOG} /hidden-data GET | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})


router.post("/hidden-data", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  const {data} = req.body
  console.log(`${LOG} /hidden-data POST | user: ${session.user.id}`);
  try {
    const result = await saveHiddenData(session.user.id, data)
    console.log(`${LOG} /hidden-data POST | saved | user: ${session.user.id}`);
    res.status(200).json({data: result.rows[0]})
  } catch (error) {
    console.error(`${LOG} /hidden-data POST | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})


export default router;
