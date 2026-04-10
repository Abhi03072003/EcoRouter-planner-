import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import routeRoutes from "./routes/routes.js";
import reviewRoutes from "./routes/reviews.js";
import helpRoutes from "./routes/help.js";
import platformRoutes from "./routes/platform.js";
import publicRoutes from "./routes/public.js";
import extraRoutes from "./routes/extras.js";
import { handleError } from "./lib/http.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distPath = path.join(rootDir, "dist");
const indexPath = path.join(distPath, "index.html");
const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const allowedOrigins = new Set([CLIENT_ORIGIN, "http://127.0.0.1:5173", "http://localhost:5173"]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/help", helpRoutes);
app.use("/api", platformRoutes);
app.use("/api", publicRoutes);
app.use("/api", extraRoutes);
app.get("/api", (_req, res) => res.json({ ok: true, service: "EcoRoute API" }));

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get(/^(?!\/api).*/, (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send("Frontend build not found. Run npm run build.");
});

app.use((error, _req, res, _next) => handleError(res, error));

app.listen(PORT, () => {
  console.log(`EcoRoute server running on http://localhost:${PORT}`);
});
