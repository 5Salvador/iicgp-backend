// routes/eventsRoutes.js
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../db/mongo.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import cloudinary from "../config/cloudinary.js";
import { upload } from "../middleware/uploadCloudinary.js";

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

// POST - Upload de flyer (DEVE ESTAR ANTES DO PUT /:id)
router.post("/:id/flyer", verifyToken, upload.single("flyer"), async (req, res) => {
  console.log("🎯 POST /:id/flyer chamada! ID:", req.params.id);
  try {
    const db = getDB();
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
    const result = await db.collection("events").findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { flyer: req.file.path, flyerPublicId: req.file.filename } },
      { returnDocument: "after" }
    );
    res.json(result);
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ message: "Erro ao enviar flyer", error: err.message });
  }
});

// DELETE - Remover flyer
router.delete("/:id/flyer", verifyToken, async (req, res) => {
  console.log("🎯 DELETE /:id/flyer chamada! ID:", req.params.id);
  try {
    const db = getDB();
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (!event?.flyerPublicId) {
      return res.status(404).json({ message: "Flyer não encontrado" });
    }
    await cloudinary.uploader.destroy(event.flyerPublicId);
    await db.collection("events").updateOne(
      { _id: event._id },
      { $unset: { flyer: "", flyerPublicId: "" } }
    );
    res.json({ message: "Flyer removido" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao remover flyer" });
  }
});

// PUT - atualizar evento (DEPOIS das rotas de flyer)
router.put("/:id", verifyToken, async (req, res) => {
  console.log("🎯 PUT /:id chamada! ID:", req.params.id);
  try {
    const db = getDB();
    await db.collection("events").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    const updated = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar evento", error: err.message });
  }
});

// DELETE - remover evento (SEMPRE POR ÚLTIMO)
router.delete("/:id", verifyToken, async (req, res) => {
  console.log("🎯 DELETE /:id chamada! ID:", req.params.id);
  try {
    const db = getDB();
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (event?.flyerPublicId) {
      await cloudinary.uploader.destroy(event.flyerPublicId);
    }
    await db.collection("events").deleteOne({ _id: event._id });
    res.json({ message: "Evento removido com sucesso" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir evento" });
  }
});

export default router;