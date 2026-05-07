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

router.get("/health-profile", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) { res.status(401).send("User not authenticated"); return }
  console.log(`${LOG} /health-profile GET | user: ${session.user.id}`);
  try {
    const result = await db.query(
      "SELECT date_of_birth, sex, weight_kg, height_cm, blood_type, conditions, medications, allergies FROM health_profile WHERE user_id = $1",
      [session.user.id]
    )
    res.status(200).json({ data: result.rows[0] ?? null })
  } catch (error) {
    console.error(`${LOG} /health-profile GET | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.post("/health-profile", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) { res.status(401).send("User not authenticated"); return }
  const { date_of_birth, sex, weight_kg, height_cm, blood_type, conditions, medications, allergies } = req.body
  console.log(`${LOG} /health-profile POST | user: ${session.user.id}`);
  try {
    const result = await db.query(
      `INSERT INTO health_profile (user_id, date_of_birth, sex, weight_kg, height_cm, blood_type, conditions, medications, allergies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) DO UPDATE SET
         date_of_birth = EXCLUDED.date_of_birth,
         sex           = EXCLUDED.sex,
         weight_kg     = EXCLUDED.weight_kg,
         height_cm     = EXCLUDED.height_cm,
         blood_type    = EXCLUDED.blood_type,
         conditions    = EXCLUDED.conditions,
         medications   = EXCLUDED.medications,
         allergies     = EXCLUDED.allergies,
         updated_at    = now()
       RETURNING date_of_birth, sex, weight_kg, height_cm, blood_type, conditions, medications, allergies`,
      [
        session.user.id,
        date_of_birth  || null,
        sex            || null,
        weight_kg      || null,
        height_cm      || null,
        blood_type     || null,
        conditions     ?? '',
        medications    ?? '',
        allergies      ?? '',
      ]
    )
    res.status(200).json({ data: result.rows[0] })
  } catch (error) {
    console.error(`${LOG} /health-profile POST | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.get("/stats", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) { res.status(401).send("User not authenticated"); return }
  console.log(`${LOG} /stats GET | user: ${session.user.id}`);
  try {
    const [convRes, msgRes, userRes] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS count FROM conversation WHERE user_id = $1", [session.user.id]),
      db.query(
        `SELECT COUNT(*)::int AS count FROM message m
         JOIN conversation c ON c.id = m.conversation_id
         WHERE c.user_id = $1 AND m.role = 'user'`,
        [session.user.id]
      ),
      db.query('SELECT "createdAt" FROM "user" WHERE id = $1', [session.user.id]),
    ])

    res.status(200).json({
      conversationCount: convRes.rows[0].count,
      messageCount:      msgRes.rows[0].count,
      memberSince:       userRes.rows[0]?.createdAt ?? null,
    })
  } catch (error) {
    console.error(`${LOG} /stats GET | error | user: ${session.user.id}`, error)
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})


export default router;
