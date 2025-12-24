import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

let db;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    console.log("MongoDB conectado via driver nativo");
  } catch (err) {
    console.error("Erro na conexão MongoDB:", err);
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Conexão com MongoDB não inicializada");
  }
  return db;
}
