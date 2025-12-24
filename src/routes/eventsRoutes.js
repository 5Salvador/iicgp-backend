// routes/eventsRoutes.js
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/mongo.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET - listar eventos
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const events = await db.collection("events")
      .find()
      .sort({ "date.month": 1, "date.day": 1 })
      .toArray();
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar eventos", error: err.message });
  }
});

// POST - criar evento
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("events").insertOne(req.body);
    const insertedEvent = await db.collection("events").findOne({ _id: result.insertedId });
    res.status(201).json(insertedEvent);
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar evento", error: err.message });
  }
});

// PUT - atualizar evento
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const result = await db.collection("events").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
      { returnDocument: "after" }
    );
    res.json(result.value);
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar evento", error: err.message });
  }
});

// DELETE - remover evento
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    await db.collection("events").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Evento removido com sucesso" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir evento", error: err.message });
  }
});

export default router;
