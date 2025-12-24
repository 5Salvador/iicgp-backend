import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { getDB } from "../db/mongo.js";
import fs from "fs";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/upload",
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "tracks" },
  ]),
  async (req, res) => {
    try {
      const db = getDB();

      // Upload cover
      const coverUpload = await cloudinary.uploader.upload(
        req.files.cover[0].path,
        { folder: "teachings/covers" }
      );

      // Remove cover file
      if (req.files.cover && req.files.cover[0]) {
        fs.unlink(req.files.cover[0].path, (err) => {
          if (err) console.error("Erro ao deletar capa temporária:", err);
        });
      }

      // Upload tracks
      const tracks = [];
      for (let i = 0; i < req.files.tracks.length; i++) {
        const file = req.files.tracks[i];
        const audioUpload = await cloudinary.uploader.upload(file.path, {
          resource_type: "video",
          folder: "teachings/tracks",
        });

        // Remove track file
        fs.unlink(file.path, (err) => {
          if (err) console.error("Erro ao deletar faixa temporária:", err);
        });

        tracks.push({
          title: file.originalname,
          url: audioUpload.secure_url,
          public_id: audioUpload.public_id,
          order: i + 1,
        });
      }

      const teaching = {
        title: req.body.title,
        preacher: req.body.preacher,
        category: req.body.category,
        cover: coverUpload.secure_url,
        tracks,
        createdAt: new Date(),
      };

      await db.collection("teachings").insertOne(teaching);

      res.status(201).json(teaching);
    } catch (err) {
      res.status(500).json({ message: "Erro no upload do ensino" });
    }
  }
);

export default router;
