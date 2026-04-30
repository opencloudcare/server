import db from "../utils/db";
import {decryptHiddenData, encryptHiddenData} from "../utils/encryption";
import {QueryResult} from "pg";

export const updateEmail = async (currentEmail: string, newEmail: string) => {
  if (!currentEmail) {
    throw Error("Email is missing");
  }
  const validateEmail = await db.query('SELECT email FROM "user" WHERE email = $1', [newEmail]);
  if (validateEmail.rows.length > 0) {
    throw Error("Email already associated with an account.");
  }
  return await db.query('UPDATE "user" SET email = $1 WHERE email = $2', [newEmail, currentEmail])
}

export const saveHiddenData = async (userId: string, data: string[]) : Promise<QueryResult>  => {
  const encryptedData = encryptHiddenData(data, userId);
  return await db.query('UPDATE hidden_data SET data = $1 WHERE user_id = $2', [encryptedData, userId])
}

export const getHiddenData = async (userId: string) : Promise<string[]> => {
  const {rows} = await db.query('SELECT data FROM hidden_data WHERE user_id = $1', [userId])
  if (rows.length === 0 || !rows[0].data) return []
  return decryptHiddenData(rows[0].data, userId);
}