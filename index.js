import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { connectDatabase } from "./src/config/database.js";
import adminRoutes from "./src/routes/admin.routes.js";
import publicRoutes from "./src/routes/public.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const validateEnv = () => {
  const required = ["MONGODB_URI", "ADMIN_JWT_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  if (process.env.ADMIN_PASSWORD === "password") {
    console.warn("WARNING: ADMIN_PASSWORD is set to default 'password'. Change it!");
  }
};

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

const parseOrigins = (raw) => {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};
const allowedOrigins = parseOrigins(process.env.FRONTEND_ORIGIN).length
  ? parseOrigins(process.env.FRONTEND_ORIGIN)
  : ["http://localhost:5173", "https://t4e-website.vercel.app"];

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tech4edges-backend" });
});

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }
  const statusCode = err.statusCode || 500;
  if (statusCode === 500) {
    console.error("Unhandled error:", err);
  }
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

const startServer = async () => {
  validateEnv();
  try {
    await connectDatabase();
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("Server startup failed:", error.message);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

startServer();

export default app;
