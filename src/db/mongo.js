import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI || !DB_NAME) {
  throw new Error("Variáveis de ambiente MONGO_URI ou DB_NAME ausentes");
}

const client = new MongoClient(MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 10000,
});

let db;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ MongoDB conectado via driver nativo");
  } catch (err) {
    console.error("❌ Erro na conexão MongoDB:", err);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) throw new Error("Conexão com MongoDB não inicializada");
  return db;
}
