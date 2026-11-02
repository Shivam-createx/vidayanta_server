import mongoose from "mongoose";
import Attendance from "../models/attendancemodel.js";
import Holiday from "../models/holidaymodel.js";

const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const validateHoliday = (date, title) =>
  validDate(date) &&
  typeof title === "string" &&
  title.trim().length > 0 &&
  title.trim().length <= 100;

const holidayConflict = (error) => error?.code === 11000;

export const getInstitutionHolidays = async (req, res) => {
  try {
    const data = await Holiday.find({
      institutionCode: req.user.institutionCode,
    })
      .sort({ date: 1 })
      .lean();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Fetch holidays error:", error.message);
    return res.status(500).json({ message: "Could not load holidays" });
  }
};

export const createInstitutionHoliday = async (req, res) => {
  try {
    const { date, title } = req.body;
    if (!validateHoliday(date, title)) {
      return res.status(400).json({
        message: "A valid date and holiday title (up to 100 characters) are required",
      });
    }

    const attendanceExists = await Attendance.exists({
      institutionCode: req.user.institutionCode,
      date,
    });
    if (attendanceExists) {
      return res.status(409).json({
        message: "A holiday cannot be added to a date with recorded attendance",
      });
    }

    const data = await Holiday.create({
      institutionCode: req.user.institutionCode,
      createdBy: req.user.userId,
      date,
      title: title.trim(),
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (holidayConflict(error)) {
      return res.status(409).json({ message: "A holiday already exists on this date" });
    }
    console.error("Create holiday error:", error.message);
    return res.status(500).json({ message: "Could not create holiday" });
  }
};

export const updateInstitutionHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, title } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid holiday ID" });
    }
    if (!validateHoliday(date, title)) {
      return res.status(400).json({
        message: "A valid date and holiday title (up to 100 characters) are required",
      });
    }

    const existing = await Holiday.findOne({
      _id: id,
      institutionCode: req.user.institutionCode,
    }).lean();
    if (!existing) return res.status(404).json({ message: "Holiday not found" });

    const attendanceExists = await Attendance.exists({
      institutionCode: req.user.institutionCode,
      date,
    });
    if (attendanceExists) {
      return res.status(409).json({
        message: "A holiday cannot be set on a date with recorded attendance",
      });
    }

    const updated = await Holiday.findByIdAndUpdate(
      id,
      { date, title: title.trim() },
      { new: true, runValidators: true },
    ).lean();
    return res.json({ success: true, data: updated });
  } catch (error) {
    if (holidayConflict(error)) {
      return res.status(409).json({ message: "A holiday already exists on this date" });
    }
    console.error("Update holiday error:", error.message);
    return res.status(500).json({ message: "Could not update holiday" });
  }
};

export const deleteInstitutionHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid holiday ID" });
    }
    const deleted = await Holiday.findOneAndDelete({
      _id: id,
      institutionCode: req.user.institutionCode,
    }).lean();
    if (!deleted) return res.status(404).json({ message: "Holiday not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete holiday error:", error.message);
    return res.status(500).json({ message: "Could not delete holiday" });
  }
};
