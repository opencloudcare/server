import {GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner"

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
  console.log("Responses: ", responses)
  return responses

}