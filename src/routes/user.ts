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
  res.status(200).json({ deleted: result.rowCount })
})


export default router;