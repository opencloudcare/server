import express, {Application, Request, Response, NextFunction} from "express";
import helmet from "helmet";
import morgan from "morgan";

const app: Application = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({status: "ok"});
})

app.use((_req: Request, res: Response) => {
    res.status(404).json({error: "Not Found"});
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({error: err.message || "Internal Server Error"});
})

export default app;