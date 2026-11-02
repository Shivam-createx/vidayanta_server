import Class from "../models/classmodel.js";
import Teacher from "../models/teachermodel.js";

export const getClassTeacherScope = async (req, classFilter) => {
  if (req.user?.role !== "teacher" || !req.user.userId) {
    return null;
  }

  const teacher = await Teacher.findOne({
    userId: req.user.userId,
    institutionCode: req.user.institutionCode,
  }).lean();

  if (!teacher) {
    return null;
  }

  const classData = await Class.findOne({
    ...classFilter,
    institutionCode: req.user.institutionCode,
    classIncharge: teacher._id,
  }).lean();

  return classData ? { teacher, classData } : null;
};

export const getAssignedTeacherClassScope = async (req, classFilter) => {
  if (req.user?.role !== "teacher" || !req.user.userId) {
    return null;
  }

  const teacher = await Teacher.findOne({
    userId: req.user.userId,
    institutionCode: req.user.institutionCode,
  }).lean();

  if (!teacher) {
    return null;
  }

  const classData = await Class.findOne({
    ...classFilter,
    institutionCode: req.user.institutionCode,
    $or: [
      { classIncharge: teacher._id },
      { "subjectTeachers.teacher": teacher._id },
    ],
  }).lean();

  return classData ? { teacher, classData } : null;
};
