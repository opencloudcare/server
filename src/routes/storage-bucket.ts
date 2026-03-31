import {Router} from "express";
import {getFiles, getUploadUrl, listFiles} from "../services/storage-bucket";

const router = Router();

router.get("/upload", async (req, res) => {
  const {bucket, key} = req.query;
  console.log(key);
  if (!bucket || !key) return res.status(400).json({message: "bucket and key are required"})
  const url = await getUploadUrl(bucket as string, key as string);
  res.status(200).json({message: "Upload url successfully created", data: url})
})

// for buckets without nested folder
router.get("/list/{*path}", async (req, res) => {
  try {
    const {path} = req.params;
    const key = req.query.key;
    if (!path){
      res.status(404).json({message: `No path provided`})
      return;
    }
    const bucket = path.join("/")
    const files = await listFiles(bucket, key as string | undefined);
    res.status(200).json({message: `List files from ${bucket}`, data: files})
  } catch (error: any) {
    res.status(500).json({error: error.message || "Internal Server Error"});
  }
})


router.get("/get/{*path}", async (req, res) => {
  try {
    const {path} = req.params;
    const key = req.query.key;
    if (!path || !key){
      res.status(404).json({message: "No path or key provided"})
      return;
    }
    const bucket = path.join("/")
    const files = await getFiles(bucket, key as string);
    res.status(200).json({message: `List files from ${bucket} bucket - PATH: ${path}`, data: files})
  } catch (error: any) {
    res.status(500).json({error: error.message || "Internal Server Error"});
  }
})


export default router;