import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB, getDB } from "./db/mongo.js";
import authRoutes from "./routes/authRoutes.js";
import eventsRoutes from "./routes/eventsRoutes.js";
import teachingsRoutes from "./routes/teachingsRoutes.js";
import audiosRoutes from "./routes/audiosRoutes.js";
import cartazRoutes from "./routes/cartazRoute.js";


if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
const app = express();
app.use(cors());
app.use(express.json());

await connectDB(); // conecta ao MongoDB

// --- ROTAS DE AUTH ---
app.use("/api/auth", authRoutes);

// --- ROTAS DE EVENTOS ---
app.use("/api/events", eventsRoutes);

// --- ROTAS DE ENSINOS ---
app.use("/api/teachings", teachingsRoutes);

// --- ROTAS DE AUDIOS ---
app.use("/api/audios", audiosRoutes);

// --- ROTAS DE CARTAZES ---
app.use("/api/cartazes", cartazRoutes);

// --- Servidor ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
