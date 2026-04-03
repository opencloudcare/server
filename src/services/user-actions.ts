import db from "../utils/db";

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