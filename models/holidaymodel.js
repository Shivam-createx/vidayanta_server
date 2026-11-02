import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    institutionCode: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

holidaySchema.index({ institutionCode: 1, date: 1 }, { unique: true });

export default mongoose.models.Holiday ||
  mongoose.model("Holiday", holidaySchema);
