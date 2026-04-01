import {Router} from "express";
import {askModel} from "../services/llm";

const router = Router();

router.post("/ask", async (req, res) => {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  try {
    const stream = await askModel(req.body.contents, req.body.searchWeb)
    for await (const chunk of stream){
      res.write(chunk.text ?? "")
    }
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

export default router;