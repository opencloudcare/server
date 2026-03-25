import express, {Application, Request, Response, NextFunction} from "express";
import helmet from "helmet";
import morgan from "morgan";
import {toNodeHandler, fromNodeHeaders} from "better-auth/node";
import {auth} from "./utils/auth";
import db from "./utils/db";
import cors from "cors"

const app: Application = express();

// CORS must be before everything, including the better-auth handler
app.use(
    cors({
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
    })
);


app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({status: "ok"});
});

app.post("/auth/check_email", async (_req: Request, res: Response) => {
    try {
        const result = await db.query('SELECT "email" FROM "user" WHERE email = $1', [_req.body.email]);
        res.json({status: 200, message: "success", data: result.rows});
    } catch (error: any) {
        console.log(error);
        res.json({status: 500, message: error.message, req: _req.body});
    }
})

app.get("/api/me", async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    res.json(session);
});

app.get("/api/dashboard", async (req: Request, res: Response) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
        res.status(401).json({error: "Unauthorized"});
        return;
    }
    res.json({message: "Welcome to the protected dashboard", user: session.user});
});

app.use((_req: Request, res: Response) => {
    res.status(404).json({error: "Not Found"});
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({error: err.message || "Internal Server Error"});
})

export default app;