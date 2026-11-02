import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Attendance from "../models/attendancemodel.js";
import Institution from "../models/institutionmodel.js";
import Result from "../models/resultmodel.js";
import Student from "../models/studentmodel.js";
import User from "../models/usermodel.js";
import emailQueue from "../queue/emailqueue.js";
import generatePassword from "../utils/generatepassword.js";
import generateUsername from "../utils/generateusername.js";
import { getClassTeacherScope } from "../utils/getclassteacher.js";

export const getClassTeacherStudents = async (req, res) => {
  try {
    const scope = await getClassTeacherScope(req, { _id: req.params.classId });
    if (!scope) {
      return res.status(403).json({ message: "Class teacher access required" });
    }

    const students = await Student.find({
      className: scope.classData.className,
      section: scope.classData.section,
      institutionCode: scope.classData.institutionCode,
      isArchived: { $ne: true },
    })
      .select("name rollNumber email mobile")
      .sort({ rollNumber: 1 })
      .lean();

    return res.json({ success: true, data: students });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createClassTeacherStudent = async (req, res) => {
  try {
    const scope = await getClassTeacherScope(req, { _id: req.params.classId });
    if (!scope) {
      return res.status(403).json({ message: "Class teacher access required" });
    }

    const { name, email, mobile, rollNumber } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedMobile = String(mobile || "").trim();
    const numericRollNumber = Number(rollNumber);

    if (
      !String(name || "").trim() ||
      !normalizedEmail ||
      !/^\d{10}$/.test(normalizedMobile) ||
      !Number.isInteger(numericRollNumber) ||
      numericRollNumber < 1
    ) {
      return res.status(400).json({
        message: "Name, valid email, 10-digit mobile, and roll number are required",
      });
    }

    const { className, section, institutionCode } = scope.classData;
    const existingStudent = await Student.findOne({
      className,
      section,
      rollNumber: numericRollNumber,
      institutionCode,
    });
    if (existingStudent) {
      return res.status(409).json({ message: "Roll number already exists" });
    }

    const institution = await Institution.findOne({ institutionCode }).lean();
    if (!institution) {
      return res.status(404).json({ message: "Institution not found" });
    }

    const branch = String(institution.branch).padStart(2, "0");
    const username = await generateUsername(
      "student",
      institutionCode,
      branch,
      className,
      section,
    );
    const password = generatePassword();
    const user = await User.create({
      username,
      password: await bcrypt.hash(password, 10),
      role: "student",
      institutionCode,
      branch,
      email: normalizedEmail,
    });

    const student = await Student.create({
      name: String(name).trim(),
      email: normalizedEmail,
      mobile: Number(normalizedMobile),
      className,
      section,
      rollNumber: numericRollNumber,
      userId: user._id,
      institutionCode,
    });

    await emailQueue.add({
      type: "CREDENTIALS",
      email: normalizedEmail,
      data: { name: student.name, username, password },
    });

    return res.status(201).json({
      success: true,
      message: "Student created and credentials emailed",
      data: {
        _id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const archiveClassTeacherStudent = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const scope = await getClassTeacherScope(req, { _id: req.params.classId });
    if (!scope) {
      return res.status(403).json({ message: "Class teacher access required" });
    }

    const student = await Student.findOneAndUpdate(
      {
        _id: req.params.studentId,
        className: scope.classData.className,
        section: scope.classData.section,
        institutionCode: scope.classData.institutionCode,
        isArchived: { $ne: true },
      },
      { isArchived: true, archivedAt: new Date() },
      { new: true },
    );

    if (!student) {
      return res.status(404).json({ message: "Active student not found" });
    }

    return res.json({
      success: true,
      message: "Student removed from the active class roster",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getClassTeacherStudentOverview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ message: "Invalid student ID" });
    }

    const student = await Student.findOne({
      _id: req.params.studentId,
      institutionCode: req.user.institutionCode,
    }).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const scope = await getClassTeacherScope(req, {
      className: student.className,
      section: student.section,
    });
    if (!scope) {
      return res.status(403).json({ message: "Class teacher access required" });
    }

    const [attendanceDocs, resultDocs] = await Promise.all([
      Attendance.find({
        "records.studentId": student._id,
        institutionCode: student.institutionCode,
      })
        .sort({ date: -1 })
        .lean(),
      Result.find({
        className: student.className,
        section: student.section,
        institutionCode: student.institutionCode,
        "results.studentId": student._id,
      })
        .sort({ date: -1 })
        .lean(),
    ]);

    const attendance = attendanceDocs.flatMap((doc) =>
      doc.records
        .filter((record) => record.studentId.toString() === student._id.toString())
        .map((record) => ({ date: doc.date, status: record.status })),
    );
    const results = resultDocs.flatMap((doc) => {
      const result = doc.results.find(
        (entry) => entry.studentId.toString() === student._id.toString(),
      );
      return result
        ? [{
            subject: doc.subject,
            testType: doc.testType,
            date: doc.date,
            maxMarks: doc.maxMarks,
            obtainedMarks: result.obtainedMarks,
            percentage: result.percentage,
            rank: result.rank,
            status: result.status || "present",
          }]
        : [];
    });

    return res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          className: student.className,
          section: student.section,
        },
        attendance,
        results,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
