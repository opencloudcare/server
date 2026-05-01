import {
  DeleteObjectCommand,
  GetObjectCommand, HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner"
import axios from "axios";

const s3 = new S3Client({
  endpoint: process.env.S3_URL,      // MinIO endpoint
  region: "us-east-1",               // any value works
  credentials: {
    accessKeyId: process.env.ACCESS_KEY || "",
    secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // required for MinIO
});


export const listFiles = async (userId: string) => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: `${userId}/documents`, // filter by folder
  });

  const response = await s3.send(command);
  return response.Contents ?? [];

}

export const getFiles = async (key: string, expiresIn = 3600) => {
  const command = new GetObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: key})
  return getSignedUrl(s3 as any, command, {expiresIn});
}

export const getUploadUrl = async (key: string, expiresIn = 3600) => {
  const command = new PutObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: key})
  return getSignedUrl(s3 as any, command, {expiresIn});
}

export const createS3FolderForUser = async (userId: string) => {
  const keys = [
    `/${userId}/metadata/`, // create the user folder + metadata (profile picture, etc.)
    `/${userId}/documents/`, // create a folder for user documents
  ]
  const responses = []
  for (const key of keys) {
    const command = new PutObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: key})
    const response = await s3.send(command)
    responses.push(response)
  }
  return responses
}

// Check if the object with the same name already exists on the same path
export const checkForExistingFile = async (key: any) : Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: key}))
    return true
  } catch (err: any) { // file not found
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false
    throw err // throw an error if the error is different to not found error
  }
}

export const deleteFile = async (key: string) => {
  const command = new DeleteObjectCommand({Bucket: process.env.S3_BUCKET_NAME, Key: key})
  return await s3.send(command);
}

// redact file
export const redactFile = async (type: string, file: Buffer, searchTerms: string[]) : Promise<Buffer> => {
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(file)], { type }), "upload")
  form.append("search_terms", JSON.stringify(searchTerms))

  const res = await axios.post(`${process.env.EXTERNAL_SERVER_URL}/api/redact`, form, {
    responseType: "arraybuffer", headers: { 'X-API-Key' : process.env.EXTERNAL_SERVER_KEY},
  })
  return Buffer.from(res.data)
}