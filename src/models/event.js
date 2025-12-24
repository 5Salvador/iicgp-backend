import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  date: {
    month: { type: String, required: true },
    day: { type: String, required: true },
  },
  time: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Event", eventSchema);
