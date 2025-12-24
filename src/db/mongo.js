import { MongoClient, ServerApiVersion } from "mongodb";

let client;
let db;
let isConnected = false;

export async function connectDB() {
  if (isConnected && db) {
    console.log("✅ Reutilizando conexão existente");
    return db;
  }

  const MONGO_URI = process.env.MONGO_URI;
  const DB_NAME = process.env.DB_NAME;

  if (!MONGO_URI || !DB_NAME) {
    throw new Error("Variáveis de ambiente MONGO_URI ou DB_NAME ausentes");
  }

  if (!client) {
      console.log("🔍 Conectando ao cluster:", MONGO_URI.split('@')[1]?.split('/')[0]);
      client = new MongoClient(MONGO_URI, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
        tls: true,
        tlsAllowInvalidCertificates: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      });
  }

  try {
    console.log("🔄 Iniciando conexão com MongoDB Atlas...");
    
    await client.connect();
    console.log("🔗 Cliente conectado, testando ping...");
    
    await client.db("admin").command({ ping: 1 });
    console.log("🏓 Ping bem-sucedido!");
    
    db = client.db(DB_NAME);
    isConnected = true;
    
    console.log(`✅ MongoDB conectado - Database: ${DB_NAME}`);
    return db;
    
  } catch (err) {
    console.error("❌ Erro detalhado na conexão:");
    console.error("  Mensagem:", err.message);
    console.error("  Código:", err.code);
    console.error("  Nome:", err.name);
    
    if (err.reason) {
      console.error("  Servidores tentados:");
      err.reason.servers?.forEach((server, addr) => {
        console.error(`    - ${addr}: ${server.error?.message || 'OK'}`);
      });
    }
    
    throw err;
  }
}

export function getDB() {
  if (!db || !isConnected) {
    throw new Error("Conexão com MongoDB não inicializada. Chame connectDB() primeiro.");
  }
  return db;
}

// Graceful shutdown
const shutdown = async () => {
  if (isConnected && client) {
    await client.close();
    console.log("🔌 MongoDB desconectado");
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);