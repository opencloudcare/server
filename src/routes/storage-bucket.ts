import express, {Router} from "express";
import {getFiles, getUploadUrl, listFiles, redactFile} from "../services/storage-bucket";
import axios from "axios";

const router = Router();

router.put("/upload", express.raw({type: ['application/pdf', 'image/*'], limit: '10mb'}), async (req, res) => {
  const {key} = req.query;
  const file = req.body;
  const type = req.headers['content-type']

  if (!key || !file || !type) return res.status(400).json({message: "key and file are required"})

  try {
    const url = await getUploadUrl(key as string);
    const redactedFile = await redactFile(type, file)
    if (!url) return res.status(500).json({message: "upload failure"})
    await axios.put(url, redactedFile, {headers: {'Content-Type': type}}) // upload into the bucket
    res.status(200).json({message: "Upload successful"})
  } catch (error) {
    console.error(error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})

// for buckets without nested folder
router.get("/list/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({message: "user id is required"})
    const files = await listFiles(userId);
    res.status(200).json({message: `List files from ${process.env.S3_BUCKET_NAME}/${userId}`, data: files})
  } catch (error: any) {
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})


router.get("/get", async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) {
      res.status(404).json({message: "No path or key provided"})
      return;
    }
    const files = await getFiles(key as string);
    res.status(200).json({message: `List files from ${process.env.S3_BUCKET_NAME} bucket - key: ${key}`, data: files})
  } catch (error: any) {
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})


export default router;