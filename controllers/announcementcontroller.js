import Announcement from "../models/announcementmodel.js";
import mongoose from "mongoose";
import Class from "../models/classmodel.js";
import Student from "../models/studentmodel.js";
import { getClassTeacherScope } from "../utils/getclassteacher.js";

// 🔥 CREATE
export const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      message,
      targetType,
      className,
      section,
      teacherId,
      studentId,
      institutionCode,
      userId
    } = req.body;

    const announcement = await Announcement.create({
      title,
      message,
      targetType,
      className: className || null,
      section: section || null,
      teacherId: teacherId || null,
      studentId: studentId || null,
      institutionCode,
      createdBy: userId
    });

    return res.status(201).json({ success: true, data: announcement });

  } catch (error) {
    console.error("Create Error:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const createTeacherClassAnnouncement = async (req, res) => {
  try {
    const { title, message, className, section, studentId } = req.body;
    if (!title?.trim() || !message?.trim() || !className || !section) {
      return res.status(400).json({ message: "Title, message, and class are required" });
    }
    const scope = await getClassTeacherScope(req, { className, section });
    if (!scope) {
      return res.status(403).json({ message: "Class teacher access required" });
    }
    let targetType = "class";
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      const student = await Student.findOne({
        _id: studentId,
        className: scope.classData.className,
        section: scope.classData.section,
        institutionCode: scope.classData.institutionCode,
        isArchived: { $ne: true },
      }).select("_id").lean();
      if (!student) {
        return res.status(400).json({ message: "Student is not in your active class" });
      }
      targetType = "student";
    }
    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      targetType,
      className: scope.classData.className,
      section: scope.classData.section,
      studentId: studentId || null,
      institutionCode: scope.classData.institutionCode,
      createdBy: req.user.userId,
    });
    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    console.error("Teacher announcement create error:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const updateTeacherAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid announcement ID" });
    }
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const updated = await Announcement.findOneAndUpdate(
      {
        _id: id,
        createdBy: req.user.userId,
        institutionCode: req.user.institutionCode,
      },
      { $set: { title: title.trim(), message: message.trim() } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      return res.status(404).json({ message: "Announcement not found or not owned by you" });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Teacher announcement update error:", error.message);
    return res.status(500).json({ message: "Could not update announcement" });
  }
};

export const deleteTeacherAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid announcement ID" });
    }
    const deleted = await Announcement.findOneAndDelete({
      _id: id,
      createdBy: req.user.userId,
      institutionCode: req.user.institutionCode,
    }).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Announcement not found or not owned by you" });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("Teacher announcement delete error:", error.message);
    return res.status(500).json({ message: "Could not delete announcement" });
  }
};


// 🔥 GET FOR TEACHER (Optimized)
export const getTeacherAnnouncements = async (req, res) => {
  try {
    const { teacherId, userId, institutionCode } = req.query;

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({ message: "Invalid teacherId" });
    }

    if (!institutionCode) {
      return res.status(400).json({ message: "Institution code required" });
    }

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    const classFilter = await Class.find({
      institutionCode,
      $or: [
        { classIncharge: teacherObjectId },
        { "subjectTeachers.teacher": teacherObjectId }
      ]
    }).select("className section").lean();

    const query = {
      institutionCode,
      $or: [
        ...(mongoose.Types.ObjectId.isValid(userId)
          ? [{ createdBy: new mongoose.Types.ObjectId(userId) }]
          : []),
        { targetType: "all" },
        { targetType: "teachers" },
        { teacherId: teacherObjectId },
        ...classFilter.map(item => ({
          targetType: "class",
          className: item.className,
          section: item.section
        }))
      ]
    };

    const data = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data });

  } catch (error) {
    console.error("Fetch Teacher Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};


// 🔥 UPDATE (Optimized)
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ...updateData } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const ann = await Announcement.findById(id).lean();

    if (!ann) return res.status(404).json({ message: "Not found" });

    if (ann.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const updated = await Announcement.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).lean();

    return res.json({ success: true, data: updated });

  } catch (error) {
    console.error("Update Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};


// 🔥 DELETE (Optimized)
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const ann = await Announcement.findById(id).lean();

    if (!ann) return res.status(404).json({ message: "Not found" });

    if (ann.createdBy.toString() !== userId) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await Announcement.findByIdAndDelete(id);

    return res.json({ success: true });

  } catch (error) {
    console.error("Delete Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};


// 🔥 GET (FIXED + OPTIMIZED)
export const getAnnouncements = async (req, res) => {
  try {
    const {
      role,
      institutionCode,
      userId,
      studentId,
      className,
      section
    } = req.query;

    let query = { institutionCode };

    // ✅ ADMIN
    if (role === "instituteadmin") {
      query.createdBy = userId;
    }

    // ✅ STUDENT
    if (role === "student") {
      query.$or = [
        { targetType: "all" },
        { targetType: "students" },

        {
          targetType: "class",
          className,
          section
        },

        {
          targetType: "student",
          studentId: studentId || userId
        }
      ];
    }

    // ✅ TEACHER
    if (role === "teacher") {
      query.$or = [
        { targetType: "all" },
        { targetType: "teachers" },

        {
          targetType: "class",
          className,
          section
        },

        {
          targetType: "teacher",
          teacherId: userId
        }
      ];
    }

    const data = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const ann = await Announcement.findById(id).lean();

    if (!ann) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.json(ann);

  } catch (error) {
    console.error("Fetch One Error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};
