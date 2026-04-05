import { betterAuth } from "better-auth";
import { Pool } from "pg";
import db from "./db";

export const auth = betterAuth({
    trustedOrigins: ["http://localhost:5173"],
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
                await db.query("DELETE FROM conversation WHERE user_id = $1", [user.id])
                // TODO: when you have user preference table delete that as well here
            },
            afterDelete: async (user) => {
                console.log(`User ${user.email} deleted successfully -> ID: ${user.id}`);
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