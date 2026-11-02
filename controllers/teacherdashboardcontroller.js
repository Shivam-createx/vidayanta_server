import mongoose from "mongoose";
import Teacher from "../models/teachermodel.js";
import Class from "../models/classmodel.js";
import Student from "../models/studentmodel.js";
import Homework from "../models/homeworkmodel.js";
import Announcement from "../models/announcementmodel.js";
import Result from "../models/resultmodel.js";

export const getTeacherDashboard = async (req, res) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      return res.status(400).json({
        message: teacherId ? "Invalid teacher ID" : "Teacher ID required"
      });
    }

    // 🔥 get teacher
    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const [allClasses, inchargeClasses] = await Promise.all([
      Class.find({
        institutionCode: teacher.institutionCode,
        $or: [
          { classIncharge: teacherId },
          { "subjectTeachers.teacher": teacherId }
        ]
      }).lean(),

      Class.find({
        classIncharge: teacherId,
        institutionCode: teacher.institutionCode
      }).lean(),
    ]);

    const [homework, announcements, latestResultData] = await Promise.all([
      Homework.find({
        teacherId,
        institutionCode: teacher.institutionCode
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      Announcement.find({
        institutionCode: teacher.institutionCode,
        $or: [
          ...(teacher.userId ? [{ createdBy: teacher.userId }] : []),
          { targetType: "all" },
          { targetType: "teachers" },
          { targetType: "teacher", teacherId },
          ...allClasses.map(c => ({
            targetType: "class",
            className: c.className,
            section: c.section
          }))
        ]
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      Result.findOne({
        teacherId,
        institutionCode: teacher.institutionCode
      })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // 🔥 students (only for classes where the teacher is in-charge)
    let students = [];
    if (inchargeClasses.length > 0) {
      const rawStudents = await Student.find({
        institutionCode: teacher.institutionCode,
        isArchived: { $ne: true },
        $or: inchargeClasses.map(c => ({
          className: c.className,
          section: c.section
        }))
      }).lean();

      const map = new Map();
      rawStudents.forEach(s => map.set(s._id.toString(), s));
      students = [...map.values()];
    }

    const recentStudents = students.slice(0, 5);

    // 🔥 latest result formatting
    let latestResult = "No result";
    if (latestResultData) {
      latestResult = `${latestResultData.subject} (${latestResultData.testType})`;
    }

    // 🔥 response
   res.json({
      success: true,
      data: {
        teacherName: teacher.teacherName || "Sir",

        // ✅ SHOW ONLY INCHARGE CLASSES
        totalClasses: inchargeClasses.length,
        assignedClasses: allClasses.length,
        classes: inchargeClasses.map(
          c => `${c.className} ${c.section}`
        ),

        totalStudents: students.length,
        latestResult,

        students: recentStudents,
        homework,
        announcements
      }
    });

  } catch (error) {
    console.error("Teacher Dashboard Error:", error);
    res.status(500).json({ message: error.message });
  }
};