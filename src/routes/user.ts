import {Router} from "express";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";
import {updateEmail} from "../services/user-actions";
import db from "../utils/db";


const router = Router()

router.post("/update/email", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }

  try {
    const response = await db.query('SELECT "providerId" FROM account WHERE "userId" = $1', [session.user.id])
    const onlyCredential = response.rows.length === 1 && response.rows[0].providerId === "credential"
    if (!onlyCredential) {
      res.status(403).send("Cannot change email connected to OAuth")
      return
    }
    await updateEmail(session.user.email, req.body.email)
    res.status(200).send("ok")

  } catch (error) {
    console.log(error instanceof Error ? error.message : "Internal Server Error")
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})

router.delete("/conversations/all", async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    return
  }
  const result = await db.query("DELETE FROM conversation WHERE user_id = $1", [session.user.id])
  res.status(200).json({deleted: result.rowCount})
})

router.get("/connections/:id", async (req, res) => {
  try {
    const result = await db.query('SELECT "providerId" FROM account WHERE "userId" = $1', [req.params.id])
    res.status(200).json({data: result.rows})

  } catch (error) {
    console.log(error instanceof Error ? error.message : "Internal Server Error")
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error")
  }
})


export default router;