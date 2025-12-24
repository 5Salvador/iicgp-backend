import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { ObjectId } from "mongodb";
import { getDB } from "../db/mongo.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const router = express.Router();
const upload = multer({ dest: "uploads/" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ======================
   CRIAR ENSINO (CARD)
====================== */
router.post("/teachings", async (req, res) => {
  try {
    const db = getDB();

    // Validação
    if (!req.body.title || !req.body.preacher || !req.body.category) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    const teaching = {
      title: req.body.title,
      preacher: req.body.preacher,
      category: req.body.category,
      cover: req.body.cover || null,
      createdAt: new Date(),
    };

    const result = await db
      .collection("teachings_audio")
      .insertOne(teaching);

    res.status(201).json({ ...teaching, _id: result.insertedId });
  } catch (error) {
    console.error("Erro ao criar ensino:", error);
    res.status(500).json({ error: "Erro ao criar ensino" });
  }
});

/* ======================
   LISTAR ENSINOS
====================== */
router.get("/teachings", async (req, res) => {
  try {
    const db = getDB();

    const teachings = await db
      .collection("teachings_audio")
      .aggregate([
        {
          $lookup: {
            from: "tracks",
            localField: "_id",
            foreignField: "teachingId",
            as: "tracks",
          },
        },
        {
          $addFields: {
            trackCount: { $size: "$tracks" },
          },
        },
        {
          $project: { tracks: 0 },
        },
        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    res.json(teachings);
  } catch (error) {
    console.error("Erro ao listar ensinos:", error);
    res.status(500).json({ error: "Erro ao listar ensinos" });
  }
});

/* ======================
   ENSINO + FAIXAS
====================== */
router.get("/teachings/:id", async (req, res) => {
  try {
    const db = getDB();

    // Validar se o ID é válido
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const teachingId = new ObjectId(req.params.id);

    const teaching = await db
      .collection("teachings_audio")
      .findOne({ _id: teachingId });

    if (!teaching) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    const tracks = await db
      .collection("tracks")
      .find({ teachingId })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({ ...teaching, tracks });
  } catch (error) {
    console.error("Erro ao buscar ensino:", error);
    res.status(500).json({ error: "Erro ao buscar ensino" });
  }
});

/* ======================
   UPLOAD DE CAPA
====================== */
router.post("/upload/cover", upload.single("cover"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Imagem não enviada" });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "image",
      folder: "church_covers",
      transformation: [
        { width: 500, height: 500, crop: "fill" }, // Redimensiona para 500x500
        { quality: "auto" }, // Otimiza automaticamente
      ],
    });

    // Remove arquivo temporário
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Erro ao deletar arquivo temporário:", err);
    });

    res.json({
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });
  } catch (error) {
    console.error("Erro ao fazer upload da capa:", error);
    res.status(500).json({ error: "Erro ao fazer upload da capa" });
  }
});

/* ======================
   UPLOAD DE FAIXA
====================== */
router.post("/upload", upload.single("audio"), async (req, res) => {
  try {
    const db = getDB();

    // Validações
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo de áudio não enviado" });
    }

    if (!req.body.teachingId || !ObjectId.isValid(req.body.teachingId)) {
      return res.status(400).json({ error: "teachingId inválido" });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "church_audios",
    });

    const track = {
      title: req.body.title || "Sem título",
      preacher: req.body.preacher || "Desconhecido",
      teachingId: new ObjectId(req.body.teachingId),
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      createdAt: new Date(),
    };

    const result = await db.collection("tracks").insertOne(track);

    // Remove arquivo temporário
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Erro ao deletar arquivo temporário:", err);
    });

    res.status(201).json({ ...track, _id: result.insertedId });
  } catch (error) {
    console.error("Erro ao fazer upload da faixa:", error);
    res.status(500).json({ error: "Erro ao fazer upload da faixa" });
  }
});

/* ======================
   ÁUDIO SOLO
====================== */
router.post("/upload/single", upload.single("audio"), async (req, res) => {
  try {
    const db = getDB();

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo de áudio não enviado" });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video",
      folder: "audios",
    });

    const audio = {
      title: req.body.title || "Sem título",
      preacher: req.body.preacher || "Desconhecido",
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      createdAt: new Date(),
    };

    const result = await db.collection("audios").insertOne(audio);

    // Remove arquivo temporário
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Erro ao deletar arquivo temporário:", err);
    });

    res.status(201).json({ ...audio, _id: result.insertedId });
  } catch (error) {
    console.error("Erro ao fazer upload do áudio solo:", error);
    res.status(500).json({ error: "Erro ao fazer upload" });
  }
});

/* ======================
   LISTAR ÁUDIOS SOLO
====================== */
router.get("/solo", async (req, res) => {
  try {
    const db = getDB();
    const tracks = await db
      .collection("audios")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json(tracks);
  } catch (error) {
    console.error("Erro ao listar áudios solo:", error);
    res.status(500).json({ error: "Erro ao listar áudios" });
  }
});

export default router;