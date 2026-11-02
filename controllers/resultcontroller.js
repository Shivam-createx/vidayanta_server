import Result from "../models/resultmodel.js";
import mongoose from "mongoose";
import Student from "../models/studentmodel.js";
import { getAssignedTeacherClassScope } from "../utils/getclassteacher.js";

// ✅ CREATE RESULT WITH % + RANK
export const createResult = async (req, res) => {
  try {
    const {
      className,
      section,
      subject,
      testType,
      maxMarks,
      results
    } = req.body;

    // ✅ VALIDATION (NEW ADD)
    if (
      !className ||
      !section ||
      !subject ||
      !testType ||
      !Number.isFinite(Number(maxMarks)) ||
      Number(maxMarks) <= 0 ||
      !Array.isArray(results) ||
      results.length === 0
    ) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    const scope = await getAssignedTeacherClassScope(req, {
      className,
      section,
    });
    if (!scope) {
      return res.status(403).json({ message: "Assigned teacher access required" });
    }

    const isClassIncharge =
      scope.classData.classIncharge?.toString() ===
      scope.teacher._id.toString();
    const teachesSubject = scope.classData.subjectTeachers.some(
      (assignment) =>
        assignment.teacher.toString() === scope.teacher._id.toString() &&
        assignment.subject.trim().toLowerCase() === subject.trim().toLowerCase(),
    );
    if (!isClassIncharge && !teachesSubject) {
      return res.status(403).json({
        message: "You are not assigned to teach this subject in the class",
      });
    }

    const allowedTypes = ["class test", "unit test", "mid term", "final"];
    if (!allowedTypes.includes(testType)) {
      return res.status(400).json({ message: "Invalid exam category" });
    }

    const studentIds = results.map((result) => String(result.studentId || ""));
    if (
      studentIds.some((id) => !mongoose.Types.ObjectId.isValid(id)) ||
      new Set(studentIds).size !== studentIds.length
    ) {
      return res.status(400).json({ message: "Invalid or duplicate student ID" });
    }
    const students = await Student.find({
      _id: { $in: studentIds },
      className: scope.classData.className,
      section: scope.classData.section,
      institutionCode: scope.classData.institutionCode,
      isArchived: { $ne: true },
    })
      .select("_id")
      .lean();
    if (students.length !== studentIds.length) {
      return res.status(400).json({
        message: "Results must include only active students in your class",
      });
    }

    const normalizedResults = [];
    for (const result of results) {
      const obtainedMarks = Number(result.obtainedMarks);
      const status = result.status || "present";
      if (
        !["present", "absent"].includes(status) ||
        !Number.isFinite(obtainedMarks) ||
        obtainedMarks < 0 ||
        obtainedMarks > Number(maxMarks) ||
        (status === "absent" && obtainedMarks !== 0)
      ) {
        return res.status(400).json({
          message: "Enter valid marks for every student",
        });
      }
      normalizedResults.push({ ...result, obtainedMarks, status });
    }

    const date = new Date().toISOString().split("T")[0];

    const processed = normalizedResults.map(r => ({
      ...r,
      percentage: r.status === "absent" ? 0 : (r.obtainedMarks / maxMarks) * 100
    }));

    // 🔥 sort once
    processed.sort((a, b) => b.obtainedMarks - a.obtainedMarks);

    // 🔥 rank optimized (no repeated lookup)
    let rank = 1;
    for (let i = 0; i < processed.length; i++) {
      if (i > 0 && processed[i].obtainedMarks < processed[i - 1].obtainedMarks) {
        rank = i + 1;
      }

      processed[i].rank = processed[i].status === "absent" ? null : rank;
    }
    // ✅ SAVE (MULTIPLE ALLOWED NOW)
    await Result.create({
      teacherId: scope.teacher._id,
      institutionCode: scope.classData.institutionCode,
      className: scope.classData.className,
      section: scope.classData.section,
      subject: subject.trim(),
      testType,
      maxMarks,
      date,
      results: processed
    });

    res.json({
      message: "Result uploaded successfully"
    });

  } catch (error) {
    // console.log(error);
    res.status(500).json({
      message: error.message
    });
  }
};
// ✅ GET RESULT (TEACHER)
export const getMyResults = async (req, res) => {
  try {
    const { teacherId } = req.query;

    const data = await Result.find({ teacherId })
      .populate("results.studentId", "name rollNumber")
      .sort({ date: -1 }).lean();

    res.json({ data });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
//student
export const getStudentResults = async (req, res) => {
  try {
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        message: "Student ID required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID"
      });
    }

    // 🔥 Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(studentId);

    // 🔥 Find all results where this student exists
    let results = await Result.find({
        "results.studentId": objectId
      })
        .populate("results.studentId", "name rollNumber")
        .sort({ date: -1 })
        .lean();

    if (!results.length) {
      return res.status(200).json({
        message: "No results found",
        data: []
      });
    }

    results = results.map(test => {
      const sorted = [...test.results].sort(
        (a, b) => b.obtainedMarks - a.obtainedMarks
      );

      let rank = 1;

      const updatedResults = sorted.map((r, index) => {
        if (index > 0 && r.obtainedMarks < sorted[index - 1].obtainedMarks) {
          rank = index + 1;
        }

        return {
          ...r,
          rank: r.status === "absent" ? "-" : rank
        };
      });

      return {
        ...test,
        results: updatedResults
      };
    });

    res.status(200).json({
      message: "Student results fetched",
      data: results
    });

  } catch (error) {
    // console.log("❌ Fetch Student Results Error:", error);
    res.status(500).json({
      message: "Server Error"
    });
  }
};


export const getStudentsResultsSummary = async (req, res) => {
  try {
    const { className, section, institutionCode } = req.query;

    const students = await Student.find({
      className,
      section,
      institutionCode,
      isArchived: { $ne: true }
    }).lean();

    const results = await Result.find({
      className,
      section,
      institutionCode
    }).lean();

    const summary = students.map(stu => {
      let totalMarks = 0;
      let totalMax = 0;

      results.forEach(r => {
        const studentData = r.results.find(
          s => s.studentId.toString() === stu._id.toString()
        );

        if (studentData) {
          totalMarks += studentData.obtainedMarks;
          totalMax += r.maxMarks;
        }
      });

      const percentage = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
      return {
        _id: stu._id,
        name: stu.name,
        rollNumber: stu.rollNumber,
        percentage,
        mobile: stu.mobile,     // ✅ ADD
        email: stu.email,
      };
    });
    summary.sort((a, b) => b.percentage - a.percentage);
    summary.forEach((stu, index) => {
      stu.rank = index + 1;
    });
    return res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// DELETE RESULT
export const deleteResult = async (req, res) => {
  try {
    await Result.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Result deleted"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE RESULT
export const updateResult = async (req, res) => {
  try {
    const { results, maxMarks, className, section, subject, testType } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid result ID" });
    }
    const existing = await Result.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ message: "Result not found" });
    }
    if (
      className !== existing.className ||
      section !== existing.section ||
      !subject?.trim() ||
      !Number.isFinite(Number(maxMarks)) ||
      Number(maxMarks) <= 0 ||
      !Array.isArray(results) ||
      results.length === 0
    ) {
      return res.status(400).json({ message: "Invalid result details" });
    }
    const scope = await getAssignedTeacherClassScope(req, {
      className: existing.className,
      section: existing.section,
    });
    if (!scope) {
      return res.status(403).json({ message: "Assigned teacher access required" });
    }
    const isClassIncharge =
      scope.classData.classIncharge?.toString() === scope.teacher._id.toString();
    const teachesSubject = scope.classData.subjectTeachers.some(
      (assignment) =>
        assignment.teacher.toString() === scope.teacher._id.toString() &&
        assignment.subject.trim().toLowerCase() === subject.trim().toLowerCase(),
    );
    if (!isClassIncharge && !teachesSubject) {
      return res.status(403).json({ message: "You are not assigned to this subject" });
    }
    const allowedTypes = ["class test", "unit test", "mid term", "final"];
    if (!allowedTypes.includes(testType)) {
      return res.status(400).json({ message: "Invalid exam category" });
    }

    const studentIds = results.map((result) => String(result.studentId || ""));
    if (
      studentIds.some((studentId) => !mongoose.Types.ObjectId.isValid(studentId)) ||
      new Set(studentIds).size !== studentIds.length
    ) {
      return res.status(400).json({ message: "Invalid or duplicate student ID" });
    }
    const students = await Student.find({
      _id: { $in: studentIds },
      className: scope.classData.className,
      section: scope.classData.section,
      institutionCode: scope.classData.institutionCode,
      isArchived: { $ne: true },
    }).select("_id").lean();
    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: "Results must include only active students in your class" });
    }

    const processed = results.map((result) => {
      const obtainedMarks = Number(result.obtainedMarks);
      const status = result.status || "present";
      if (
        !["present", "absent"].includes(status) ||
        !Number.isFinite(obtainedMarks) ||
        obtainedMarks < 0 ||
        obtainedMarks > Number(maxMarks) ||
        (status === "absent" && obtainedMarks !== 0)
      ) {
        throw new Error("Enter valid marks for every student");
      }
      return {
        studentId: result.studentId,
        obtainedMarks,
        status,
        percentage: status === "absent" ? 0 : (obtainedMarks / Number(maxMarks)) * 100,
      };
    });
    processed.sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    let rank = 1;
    for (let index = 0; index < processed.length; index++) {
      if (index > 0 && processed[index].obtainedMarks < processed[index - 1].obtainedMarks) {
        rank = index + 1;
      }
      processed[index].rank = processed[index].status === "absent" ? null : rank;
    }

    const updated = await Result.findByIdAndUpdate(
      req.params.id,
      { subject: subject.trim(), testType, maxMarks: Number(maxMarks), results: processed },
      { new: true, runValidators: true },
    );
    return res.json({ success: true, data: updated });
  } catch (error) {
    const status = error.message === "Enter valid marks for every student" ? 400 : 500;
    return res.status(status).json({ message: error.message });
  }
};