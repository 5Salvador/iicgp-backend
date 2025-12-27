import express from "express";
import { getDB } from "../db/mongo.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

/* ================================
   Cloudinary configuration
================================ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================================
   Multer (memory storage)
================================ */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

/* ================================
   Upload buffer to Cloudinary
================================ */
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/* ================================
   Router
================================ */
const router = express.Router();

/* =========================================================
   GET ALL CARTAZES (PUBLIC)
   Returns array of all cartazes, sorted by newest first
========================================================= */
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const cartazes = await db
      .collection("cartazes")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(cartazes);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch cartazes",
      error: error.message,
    });
  }
});

/* =========================================================
   GET SINGLE CARTAZ BY ID (PUBLIC)
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid cartaz ID" });
    }

    const db = getDB();

    const cartaz = await db
      .collection("cartazes")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!cartaz) {
      return res.status(404).json({ message: "Cartaz not found" });
    }

    res.json(cartaz);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch cartaz",
      error: error.message,
    });
  }
});

/* =========================================================
   UPLOAD CARTAZ (ADMIN)
   Now supports multiple cartazes
========================================================= */
router.post(
  "/",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Image is required" });
      }

      const db = getDB();

      // Upload new image
      const result = await uploadToCloudinary(
        req.file.buffer,
        "cartazes"
      );

      const cartaz = {
        title: req.body.title || "",
        imageUrl: result.secure_url,
        publicId: result.public_id,
        createdAt: new Date(),
      };

      const saved = await db.collection("cartazes").insertOne(cartaz);

      res.status(201).json({
        message: "Cartaz uploaded successfully",
        cartaz: { ...cartaz, _id: saved.insertedId },
      });
    } catch (error) {
      res.status(500).json({
        message: "Upload failed",
        error: error.message,
      });
    }
  }
);

/* =========================================================
   DELETE CARTAZ (ADMIN)
========================================================= */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid cartaz ID" });
    }

    const db = getDB();

    const cartaz = await db
      .collection("cartazes")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!cartaz) {
      return res.status(404).json({ message: "Cartaz not found" });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(cartaz.publicId);

    // Delete from database
    await db.collection("cartazes").deleteOne({ _id: cartaz._id });

    res.json({ message: "Cartaz deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Delete failed",
      error: error.message,
    });
  }
});

/* =========================================================
   DELETE ALL CARTAZES (ADMIN) - Optional cleanup endpoint
========================================================= */
router.delete("/all/cleanup", verifyToken, async (req, res) => {
  try {
    const db = getDB();

    const cartazes = await db.collection("cartazes").find({}).toArray();

    // Delete all from Cloudinary
    for (const cartaz of cartazes) {
      try {
        await cloudinary.uploader.destroy(cartaz.publicId);
      } catch (err) {
        console.error(`Failed to delete ${cartaz.publicId} from Cloudinary:`, err);
      }
    }

    // Delete all from database
    const result = await db.collection("cartazes").deleteMany({});

    res.json({ 
      message: "All cartazes deleted successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      message: "Cleanup failed",
      error: error.message,
    });
  }
});

export default router;