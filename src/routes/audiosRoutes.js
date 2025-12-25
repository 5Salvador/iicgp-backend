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
   EDITAR ENSINO
====================== */
router.put("/teachings/:id", async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const teachingId = new ObjectId(req.params.id);
    const updateData = {};

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.preacher) updateData.preacher = req.body.preacher;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.cover !== undefined) updateData.cover = req.body.cover;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updateData.updatedAt = new Date();

    const result = await db
      .collection("teachings_audio")
      .findOneAndUpdate(
        { _id: teachingId },
        { $set: updateData },
        { returnDocument: "after" }
      );

    if (!result) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    res.json(result);
  } catch (error) {
    console.error("Erro ao editar ensino:", error);
    res.status(500).json({ error: "Erro ao editar ensino" });
  }
});

/* ======================
   DELETAR ENSINO
====================== */
router.delete("/teachings/:id", async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const teachingId = new ObjectId(req.params.id);

    // Buscar ensino para pegar o public_id da capa
    const teaching = await db
      .collection("teachings_audio")
      .findOne({ _id: teachingId });

    if (!teaching) {
      return res.status(404).json({ error: "Ensino não encontrado" });
    }

    // Buscar todas as faixas associadas
    const tracks = await db
      .collection("tracks")
      .find({ teachingId })
      .toArray();

    // Deletar capa do Cloudinary se existir
    if (teaching.cover) {
      try {
        const publicId = teaching.cover.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Erro ao deletar capa do Cloudinary:", err);
      }
    }

    // Deletar áudios das faixas do Cloudinary
    for (const track of tracks) {
      if (track.public_id) {
        try {
          await cloudinary.uploader.destroy(track.public_id, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Erro ao deletar áudio do Cloudinary:", err);
        }
      }
    }

    // Deletar todas as faixas do banco
    await db.collection("tracks").deleteMany({ teachingId });

    // Deletar o ensino
    await db.collection("teachings_audio").deleteOne({ _id: teachingId });

    res.json({ message: "Ensino e faixas deletados com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar ensino:", error);
    res.status(500).json({ error: "Erro ao deletar ensino" });
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
        { width: 500, height: 500, crop: "fill" },
        { quality: "auto" },
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
   EDITAR FAIXA
====================== */
router.put("/tracks/:id", upload.single("audio"), async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const trackId = new ObjectId(req.params.id);
    
    // Buscar faixa existente
    const existingTrack = await db.collection("tracks").findOne({ _id: trackId });
    
    if (!existingTrack) {
      return res.status(404).json({ error: "Faixa não encontrada" });
    }

    const updateData = {};

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.preacher) updateData.preacher = req.body.preacher;

    // Se um novo arquivo de áudio foi enviado
    if (req.file) {
      // Deletar áudio antigo do Cloudinary
      if (existingTrack.public_id) {
        try {
          await cloudinary.uploader.destroy(existingTrack.public_id, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Erro ao deletar áudio antigo do Cloudinary:", err);
        }
      }

      // Upload do novo áudio
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "video",
        folder: "church_audios",
      });

      updateData.url = uploadResult.secure_url;
      updateData.public_id = uploadResult.public_id;

      // Remove arquivo temporário
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Erro ao deletar arquivo temporário:", err);
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updateData.updatedAt = new Date();

    const result = await db
      .collection("tracks")
      .findOneAndUpdate(
        { _id: trackId },
        { $set: updateData },
        { returnDocument: "after" }
      );

    res.json(result);
  } catch (error) {
    console.error("Erro ao editar faixa:", error);
    res.status(500).json({ error: "Erro ao editar faixa" });
  }
});

/* ======================
   DELETAR FAIXA
====================== */
router.delete("/tracks/:id", async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const trackId = new ObjectId(req.params.id);

    // Buscar faixa para pegar o public_id
    const track = await db.collection("tracks").findOne({ _id: trackId });

    if (!track) {
      return res.status(404).json({ error: "Faixa não encontrada" });
    }

    // Deletar áudio do Cloudinary
    if (track.public_id) {
      try {
        await cloudinary.uploader.destroy(track.public_id, {
          resource_type: "video",
        });
      } catch (err) {
        console.error("Erro ao deletar áudio do Cloudinary:", err);
      }
    }

    // Deletar do banco
    await db.collection("tracks").deleteOne({ _id: trackId });

    res.json({ message: "Faixa deletada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar faixa:", error);
    res.status(500).json({ error: "Erro ao deletar faixa" });
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

/* ======================
   EDITAR ÁUDIO SOLO
====================== */
router.put("/solo/:id", upload.single("audio"), async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const audioId = new ObjectId(req.params.id);
    
    // Buscar áudio existente
    const existingAudio = await db.collection("audios").findOne({ _id: audioId });
    
    if (!existingAudio) {
      return res.status(404).json({ error: "Áudio não encontrado" });
    }

    const updateData = {};

    if (req.body.title) updateData.title = req.body.title;
    if (req.body.preacher) updateData.preacher = req.body.preacher;

    // Se um novo arquivo de áudio foi enviado
    if (req.file) {
      // Deletar áudio antigo do Cloudinary
      if (existingAudio.public_id) {
        try {
          await cloudinary.uploader.destroy(existingAudio.public_id, {
            resource_type: "video",
          });
        } catch (err) {
          console.error("Erro ao deletar áudio antigo do Cloudinary:", err);
        }
      }

      // Upload do novo áudio
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "video",
        folder: "audios",
      });

      updateData.url = uploadResult.secure_url;
      updateData.public_id = uploadResult.public_id;

      // Remove arquivo temporário
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Erro ao deletar arquivo temporário:", err);
      });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    updateData.updatedAt = new Date();

    const result = await db
      .collection("audios")
      .findOneAndUpdate(
        { _id: audioId },
        { $set: updateData },
        { returnDocument: "after" }
      );

    res.json(result);
  } catch (error) {
    console.error("Erro ao editar áudio solo:", error);
    res.status(500).json({ error: "Erro ao editar áudio" });
  }
});

/* ======================
   DELETAR ÁUDIO SOLO
====================== */
router.delete("/solo/:id", async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const audioId = new ObjectId(req.params.id);

    // Buscar áudio para pegar o public_id
    const audio = await db.collection("audios").findOne({ _id: audioId });

    if (!audio) {
      return res.status(404).json({ error: "Áudio não encontrado" });
    }

    // Deletar áudio do Cloudinary
    if (audio.public_id) {
      try {
        await cloudinary.uploader.destroy(audio.public_id, {
          resource_type: "video",
        });
      } catch (err) {
        console.error("Erro ao deletar áudio do Cloudinary:", err);
      }
    }

    // Deletar do banco
    await db.collection("audios").deleteOne({ _id: audioId });

    res.json({ message: "Áudio deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar áudio solo:", error);
    res.status(500).json({ error: "Erro ao deletar áudio" });
  }
});

export default router;