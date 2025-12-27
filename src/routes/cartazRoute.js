import express from "express";
import { getDB } from "../db/mongo.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

//Cloudinary connection
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//Muler memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

//Upload buffer to Cloudinary
export const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};


//Routes starting
const router = express.Router();


/**
 * UPLOAD CARTAZ
 */
router.post(
  "/",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image is required" });
      }

      const result = await uploadToCloudinary(
        req.file.buffer,
        "cartazes"
      );

      const cartaz = {
        title: req.body.title || "",
        imageUrl: result.secure_url,
        publicId: result.public_id,
        createdAt: new Date()
      };

      const db = getDB();
      const saved = await db.collection("cartazes").insertOne(cartaz);

      res.status(201).json({
        message: "Cartaz uploaded successfully",
        cartaz: { ...cartaz, _id: saved.insertedId }
      });
    } catch (error) {
      res.status(500).json({
        message: "Upload failed",
        error: error.message
      });
    }
  }
);

/**
 * DELETE CARTAZ
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const cartaz = await db
      .collection("cartazes")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!cartaz) {
      return res.status(404).json({ message: "Cartaz not found" });
    }

    await cloudinary.uploader.destroy(cartaz.publicId);

    await db
      .collection("cartazes")
      .deleteOne({ _id: cartaz._id });

    res.json({ message: "Cartaz deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete failed",
      error: error.message
    });
  }
});

export default router;