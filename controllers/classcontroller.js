import mongoose from "mongoose";
import Class from "../models/classmodel.js";
import Student from "../models/studentmodel.js";
import Teacher from "../models/teachermodel.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createClass = async (req, res) => {
  try {
    const { className, section, institutionCode, classIncharge } = req.body;
    if (
      typeof className !== "string" ||
      !className.trim() ||
      typeof section !== "string" ||
      !section.trim() ||
      !institutionCode
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }
    const exists = await Class.findOne({ className, section, institutionCode });
    if (exists) {
      return res.status(409).json({ success: false, message: "Class already exists" });
    }

    if (classIncharge) {
      if (!isValidId(classIncharge)) {
        return res.status(400).json({ success: false, message: "Invalid class incharge ID" });
      }

      const teacher = await Teacher.findOne({ _id: classIncharge, institutionCode });
      if (!teacher) {
        return res.status(400).json({ success: false, message: "Class incharge not found in this institution" });
      }

      const teacherExists = await Class.findOne({ classIncharge, institutionCode });
      if (teacherExists) {
        return res.status(409).json({
          success: false,
          message: "Teacher already assigned to another class",
        });
      }
    }
    const newClass = await Class.create({
      className: className.trim(),
      section: section.trim(),
      institutionCode,
      classIncharge
    });
    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: newClass,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Class already exists" });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ✅ Get all classes
export const getAllClasses = async (req, res) => {
  try {
    const { institutionCode } = req.query;
    const filter = institutionCode ? { institutionCode } : {};
    const classes = await Class.find(filter)
      .populate({
        path:"classIncharge",
        populate:{
          path:"userId",
          select:"name email"
        }
      })
      .populate({
        path:"subjectTeachers.teacher",
        populate:{
          path:"userId",
          select:"name email"
        }
      });
    res.status(200).json({
      success: true,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const deleteClass = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid class ID" });
    }

    const deleted = await Class.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    res.json({
      success: true,
      message: "Class deleted"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const updateClass = async (req, res) => {
  try {
    const { className, section, classIncharge, subjectTeachers } = req.body;
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid class ID" });
    }

    const existing = await Class.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    const updates = {};
    if (className !== undefined) {
      if (typeof className !== "string" || !className.trim()) {
        return res.status(400).json({ success: false, message: "Class name is required" });
      }
      updates.className = className.trim();
    }
    if (section !== undefined) {
      if (typeof section !== "string" || !section.trim()) {
        return res.status(400).json({ success: false, message: "Section is required" });
      }
      updates.section = section.trim();
    }
    if (classIncharge !== undefined) {
      if (classIncharge && !isValidId(classIncharge)) {
        return res.status(400).json({ success: false, message: "Invalid class incharge ID" });
      }
      if (classIncharge) {
        const teacher = await Teacher.findOne({
          _id: classIncharge,
          institutionCode: existing.institutionCode
        });
        if (!teacher) {
          return res.status(400).json({ success: false, message: "Class incharge not found in this institution" });
        }

        const teacherAlreadyAssigned = await Class.findOne({
          _id: { $ne: existing._id },
          classIncharge,
          institutionCode: existing.institutionCode
        });
        if (teacherAlreadyAssigned) {
          return res.status(409).json({
            success: false,
            message: "Teacher already assigned to another class"
          });
        }
      }
      updates.classIncharge = classIncharge || null;
    }
    if (subjectTeachers !== undefined) {
      if (!Array.isArray(subjectTeachers)) {
        return res.status(400).json({ success: false, message: "Subject teachers must be an array" });
      }
      if (subjectTeachers.some((assignment) =>
        !assignment ||
        typeof assignment.subject !== "string" ||
        !assignment.subject.trim() ||
        !isValidId(assignment.teacher)
      )) {
        return res.status(400).json({ success: false, message: "Each subject assignment requires a subject and valid teacher ID" });
      }

      const teacherIds = [...new Set(subjectTeachers.map(({ teacher }) => teacher))];
      const teachers = await Teacher.find({
        _id: { $in: teacherIds },
        institutionCode: existing.institutionCode
      }).select("_id");
      if (teachers.length !== teacherIds.length) {
        return res.status(400).json({ success: false, message: "Subject teacher not found in this institution" });
      }
      updates.subjectTeachers = subjectTeachers.map(({ subject, teacher }) => ({
        subject: subject.trim(),
        teacher
      }));
    }

    let updated;
    try {
      updated = await Class.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: "Class already exists" });
      }
      throw error;
    }
    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const assignTeacher = async (req, res) => {
  try {
    const { classId, teacherId, subject } = req.body;
    if (!classId || !teacherId || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class ID, teacher ID, and subject are required"
      });
    }
    if (!isValidId(classId) || !isValidId(teacherId)) {
      return res.status(400).json({ success: false, message: "Invalid class or teacher ID" });
    }

    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    const teacher = await Teacher.findOne({
      _id: teacherId,
      institutionCode: classData.institutionCode
    });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found in this institution"
      });
    }
    if (!teacher.subjects.some((teacherSubject) =>
      teacherSubject.trim().toLowerCase() === subject.trim().toLowerCase()
    )) {
      return res.status(400).json({ success: false, message: "Teacher is not assigned to this subject" });
    }
    if (classData.subjectTeachers.some((assignment) =>
      assignment.teacher.toString() === teacherId && assignment.subject.toLowerCase() === subject.trim().toLowerCase()
    )) {
      return res.status(409).json({ success: false, message: "Teacher is already assigned to this subject" });
    }

    classData.subjectTeachers.push({ teacher: teacherId, subject: subject.trim() });
    const updated = await classData.save();

    res.json({
      success: true,
      data: updated
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getClassesByInstitution = async (req, res) => {
  try {
    const { institutionCode } = req.body;
    if (!institutionCode) {
      return res.status(400).json({
        success: false,
        message: "Institution code required"
      });
    }

    const classes = await Class.find({ institutionCode })
      .populate("classIncharge")
      .populate("subjectTeachers.teacher");

    res.status(200).json({
      success: true,
      classes
    });

  } catch (error) {
    // console.log("ERROR 👉", error);
    res.status(500).json({
      message: error.message
    });
  }
};
export const getMyClass = async (req, res) => {
  try {
    const { teacherId } = req.body
    if (!teacherId || !isValidId(teacherId)) {
      return res.status(400).json({
        success: false,
        message: teacherId ? "Invalid teacher ID" : "Teacher ID required"
      });
    }
    const classData = await Class.findOne({
      classIncharge: teacherId
    });

    if (!classData) {
      return res.status(404).json({
        message: "No class assigned"
      });
    }

    res.json({
      success: true,
      className: classData.className,
      section: classData.section
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getTeacherClasses = async (req, res) => {
  try {
    const { teacherId, institutionCode } = req.body;

    if (!teacherId || !isValidId(teacherId)) {
      return res.status(400).json({
        message: teacherId ? "Invalid teacher ID" : "Teacher ID required"
      });
    }

    const filter = {
      $or: [
        { classIncharge: teacherId },
        { "subjectTeachers.teacher": teacherId }
      ]
    };
    if (institutionCode) filter.institutionCode = institutionCode;

    const classes = await Class.find(filter).lean();

    const result = classes.map((cls) => {
      const subjects = (cls.subjectTeachers || [])
        .filter(st => st.teacher.toString() === teacherId)
        .map(st => st.subject);

      return {
        _id: cls._id,
        className: cls.className,
        section: cls.section,
        subjects,
        isClassIncharge: cls.classIncharge?.toString() === teacherId
      };
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    // console.log("🔥 ERROR:", error);

    res.status(500).json({
      message: error.message
    });
  }
};
//institution student 
export const getInstitutionClasses = async (req, res) => {
  try {
    const { institutionCode } = req.query;

    if (!institutionCode) {
      return res.status(400).json({
        message: "Institution code required"
      });
    }

    const classes = await Class.find({ institutionCode })
      .select("className section");

    res.json({
      success: true,
      data: classes
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
export const getStudentsByClass = async (req, res) => {
  try {
    const { className, section, institutionCode } = req.query;

    if (!className || !section || !institutionCode) {
      return res.status(400).json({
        message: "Missing fields"
      });
    }

    const students = await Student.find({
      className,
      section,
      institutionCode,
      isArchived: { $ne: true }
    }).sort({ rollNumber: 1 }).lean();

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
export const getClassById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid class ID" });
    }

    const data = await Class.findById(req.params.id)
      .populate("classIncharge")
      .populate("subjectTeachers.teacher");

    if (!data) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    res.json({
      success: true,
      data,
      class: data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};