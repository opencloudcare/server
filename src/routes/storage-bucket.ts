import express, {Router} from "express";
import {deleteFile, getFiles, getUploadUrl, listFiles, redactFile} from "../services/storage-bucket";
import axios from "axios";
import {getHiddenData} from "../services/user-actions";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";

const router = Router();

router.put("/upload", express.raw({
  type: [
    'application/pdf',
    'image/*',
    'application/oxps',
    'application/vnd.ms-xpsdocument',
    'application/epub+zip',
    'application/x-mobipocket-ebook',
    'application/x-fictionbook+xml',
    'application/x-cbz',
    'application/zip',
    'text/plain',
  ],
  limit: '50mb'
}), async (req, res) => {
  const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)})
  if (!session) {
    res.status(401).send("User not authenticated")
    console.error("Unauthorized")
    return
  }

  const {key} = req.query;
  const file = req.body;
  const type = req.headers['content-type']

  if (!key || !file || !type) {
    res.status(400).send("Key and file are required")
    console.error("Missing parameters")
    return
  }

  try {
    const url = await getUploadUrl(key as string);
    const search_terms = await getHiddenData(session.user.id);
    if (search_terms.length === 0) {
      console.error("No search terms found")
      res.status(500).json({message: "No personal information specified. Please enter the text you would like us to redact before uploading your file."})
      return
    }
    const redactedFile = await redactFile(type, file, search_terms)
    if (!url) {
      console.error("No upload URL")
      res.status(500).json({message: "upload failure"})
      return
    }
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
    console.error(error)
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
    console.error(error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})


router.delete("/delete/:key", async (req, res) => {
  const {key} = req.params;
  if (!key) {
    res.status(400).json({message: "No key provided"})
  }
  try {
    await deleteFile(key)
    res.status(200).json({message: "File successfully deleted"})
  } catch (error) {
    console.error(error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }

})

export default router;