import {Router} from "express";
import {askModel} from "../services/llm";

const router = Router();

router.post("/ask", async (req, res) => {
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  try {
    const stream = await askModel(req.body.contents)
    for await (const chunk of stream){
      res.write(chunk.text ?? "")
    }
    res.end()
  } catch (error) {
    console.error(error)
    res.end()
  }

})

export default router;