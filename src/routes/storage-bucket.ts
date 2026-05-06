import express, {Router} from "express";
import {
  checkForExistingFile,
  deleteFile,
  getFiles,
  getUploadUrl,
  listFiles,
  redactFile
} from "../services/storage-bucket";
import axios from "axios";
import {getHiddenData} from "../services/user-actions";
import {auth} from "../utils/auth";
import {fromNodeHeaders} from "better-auth/node";

const router = Router();
const LOG = "\x1b[33m[Storage]\x1b[0m";

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
    console.warn(`${LOG} /upload | unauthorized request`)
    res.status(401).send("User not authenticated")
    return
  }

  const parameters = req.query;
  let key = parameters.key as string;
  const file = req.body;
  const type = req.headers['content-type']

  if (!key || !file || !type) {
    console.error(`${LOG} /upload | missing parameters | key: ${!!key} | file: ${!!file} | type: ${!!type}`)
    res.status(400).send("Key and file are required")
    return
  }

  const sizeKB = (file.length / 1024).toFixed(1);
  console.log(`${LOG} /upload | user: ${session.user.id} | key: ${key} | type: ${type} | size: ${sizeKB}KB`);

  // check if the file with the same name already exist
  let existingFile = await checkForExistingFile(key);
  if (existingFile) {
    const originalKey = key;
    let i = 1;

    // 1. Split the path from the filename
    const lastSlashIndex = key.lastIndexOf("/");
    const path = key.slice(0, lastSlashIndex + 1);
    const fileName = key.slice(lastSlashIndex + 1);

    // 2. Split the filename into name and extension safely
    const lastDotIndex = fileName.lastIndexOf(".");
    const baseName = lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex);
    const ext = lastDotIndex === -1 ? "" : fileName.slice(lastDotIndex);

    // 3. Loop until a unique key is found
    do {
      key = `${path}${baseName}(${i})${ext}`;
      i++;
    } while (await checkForExistingFile(key))

    console.log(`${LOG} /upload | duplicate detected, renamed "${originalKey}" -> "${key}"`);
  }

  try {
    const url = await getUploadUrl(key as string);
    const search_terms = await getHiddenData(session.user.id);
    if (search_terms.length === 0) {
      console.error(`${LOG} /upload | no redaction terms configured | user: ${session.user.id}`)
      res.status(500).json({message: "No personal information specified. Please enter the text you would like us to redact before uploading your file."})
      return
    }
    if (!url) {
      console.error(`${LOG} /upload | failed to get presigned upload URL | key: ${key}`)
      res.status(500).json({message: "upload failure"})
      return
    }
    console.log(`${LOG} /upload | redacting with ${search_terms.length} term(s) | key: ${key}`);
    const redactedFile = await redactFile(type, file, search_terms)
    await axios.put(url, redactedFile, {headers: {'Content-Type': type}}) // upload into the bucket
    console.log(`${LOG} /upload | success | key: ${key}`);
    res.status(200).json({message: "Upload successful"})
  } catch (error) {
    console.error(`${LOG} /upload | error | key: ${key}`, error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})

// for buckets without nested folder
router.get("/list/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({message: "user id is required"})
    console.log(`${LOG} /list | user: ${userId}`);
    const files = await listFiles(userId);
    console.log(`${LOG} /list | returned ${files?.length ?? 0} file(s) | user: ${userId}`);
    res.status(200).json({message: `List files from ${process.env.S3_BUCKET_NAME}/${userId}`, data: files})
  } catch (error: any) {
    console.error(`${LOG} /list | error | user: ${req.params.userId}`, error)
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
    console.log(`${LOG} /get | key: ${key}`);
    const files = await getFiles(key as string);
    res.status(200).json({message: `List files from ${process.env.S3_BUCKET_NAME} bucket - key: ${key}`, data: files})
  } catch (error: any) {
    console.error(`${LOG} /get | error | key: ${req.query.key}`, error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }
})


router.delete("/delete/:key", async (req, res) => {
  const {key} = req.params;
  if (!key) {
    res.status(400).json({message: "No key provided"})
  }
  console.log(`${LOG} /delete | key: ${key}`);
  try {
    await deleteFile(key)
    console.log(`${LOG} /delete | success | key: ${key}`);
    res.status(200).json({message: "File successfully deleted"})
  } catch (error) {
    console.error(`${LOG} /delete | error | key: ${key}`, error)
    res.status(500).json({message: error instanceof Error ? error.message : "Internal Server Error"})
  }

})

export default router;
