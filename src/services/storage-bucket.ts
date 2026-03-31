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


export const listFiles = async (bucket: string, prefix?: string) => {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix, // filter by folder
  });

  const response = await s3.send(command);
  return response.Contents ?? [];

}

export const getFiles = async (bucket: string, key: string, expiresIn = 3600) => {
  const command = new GetObjectCommand({Bucket: bucket, Key: key})
  return getSignedUrl(s3 as any, command, {expiresIn});
}

export const getUploadUrl = async (bucket: string, key: string, expiresIn = 3600) => {
  const command = new PutObjectCommand({Bucket: bucket, Key: key})
  return getSignedUrl(s3 as any, command, {expiresIn});
}
