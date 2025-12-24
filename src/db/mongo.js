import { MongoClient } from "mongodb";

// Não use dotenv.config() em produção no Render
// dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
  throw new Error("MONGO_URI não definida em variáveis de ambiente");
}

if (!DB_NAME) {
  throw new Error("DB_NAME não definida em variáveis de ambiente");
}

const client = new MongoClient(MONGO_URI);

let db;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log("MongoDB conectado via driver nativo");
  } catch (err) {
    console.error("Erro na conexão MongoDB:", err);
    throw err; // Re-throw para capturar erros no index.js
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Conexão com MongoDB não inicializada");
  }
  return db;
}
