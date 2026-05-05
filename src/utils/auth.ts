import { betterAuth } from "better-auth";
import { Pool } from "pg";
import db from "./db";
import {createS3FolderForUser, deleteUserFolder} from "../services/storage-bucket";

export const auth = betterAuth({
    trustedOrigins: ["http://localhost:5173", "http://localhost:4173"],
    user: {
        additionalFields: {
            firstName: {
                type: "string",
                required: true,
            },
            lastName: {
                type: "string",
                required: true,
            },
        },
        deleteUser: {
            enabled: true,
            beforeDelete: async (user) => {
                console.log(`[DELETE] user with userId=${user.id}`)
                const convRes = await db.query("DELETE FROM conversation WHERE user_id = $1", [user.id])
                console.log(`[DELETE] ${convRes.rows.length} conversations found`)
                console.log("[DELETE] user conversations deleted ✅")
                await db.query("DELETE FROM hidden_data WHERE user_id = $1", [user.id])
                console.log("[DELETE] hidden data deleted ✅")
                await db.query("DELETE FROM user_preferences WHERE user_id = $1", [user.id])
                console.log("[DELETE] user preferences deleted ✅")
                await deleteUserFolder(user.id)
                console.log("[DELETE] user bucket deleted ✅")
            },
            afterDelete: async (user) => {
                console.log(`[DELETE ]User ${user.email} deleted successfully -> ID: ${user.id} ✅`);
            }
        }
    },
    databaseHooks: {
        user:{
            create: {
                after: async (user) => {
                    console.log(`[CREATE] USER CREATED: Name -> ${user.name}, Email -> ${user.email}`)
                    // Create S3 folder for the newly created user
                    await createS3FolderForUser(user.id);
                    console.log("[CREATE] S3 bucket ✅")
                    await db.query("INSERT INTO user_preferences (user_id) VALUES ($1)", [user.id]) // add default user preference
                    console.log("[CREATE] user preferences ✅")
                    await db.query("INSERT INTO hidden_data (user_id) VALUES ($1)", [user.id]) // add empty hidden data row
                    console.log("[INITIALIZE] hidden data ✅")
                },
            }
        }
    },
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            mapProfileToUser: (profile) => ({
                firstName: profile.given_name,
                lastName: profile.family_name,
            }),
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
    },
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
})