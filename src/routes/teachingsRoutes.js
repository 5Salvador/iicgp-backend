import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/mongo.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Listar todos os ensinos em texto
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const data = await db
      .collection("teachings_text")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(data);
  } catch (error) {
    console.error("Erro ao listar ensinos:", error);
    res.status(500).json({ error: "Erro ao listar ensinos" });
  }
});

// Buscar ensino por ID - NOVA ROTA
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();

    // Validar se o ID é válido
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const teaching = await db
      .collection("teachings_text")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!teaching) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    res.json(teaching);
  } catch (error) {
    console.error("Erro ao buscar ensino:", error);
    res.status(500).json({ error: "Erro ao buscar ensino" });
  }
});

// Criar novo ensino em texto
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { title, pastorName, content } = req.body;

    // Validação
    if (!title || !pastorName || !content) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const teaching = {
      title,
      pastorName,
      content,
      createdAt: new Date(),
    };

    const result = await db.collection("teachings_text").insertOne(teaching);
    res.status(201).json({ ...teaching, _id: result.insertedId });
  } catch (error) {
    console.error("Erro ao criar ensino:", error);
    res.status(500).json({ error: "Erro ao criar ensino" });
  }
});

// Atualizar ensino
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { title, pastorName, content } = req.body;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await db.collection("teachings_text").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          title,
          pastorName,
          content,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    res.json({ message: "Ensino atualizado com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar ensino:", error);
    res.status(500).json({ error: "Erro ao atualizar ensino" });
  }
});

// Deletar ensino
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await db
      .collection("teachings_text")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    res.json({ message: "Ensino deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar ensino:", error);
    res.status(500).json({ error: "Erro ao deletar ensino" });
  }
});

export default router;