import express from "express";
import {createStudent,
  getStudentByClass,
  getStudentsByClassSection,
  updateStudent, deleteStudent
} from "../controllers/createstudent.js"
import { emailLimiter } from "../middlerwars/ratelimter.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";
import {
  archiveClassTeacherStudent,
  createClassTeacherStudent,
  getClassTeacherStudentOverview,
  getClassTeacherStudents,
} from "../controllers/teacherstudentcontroller.js";
const router = express.Router();
router.post("/create-student",emailLimiter,createStudent);
router.get("/class/:className/:section",getStudentByClass);
router.post("/by-class-section", emailLimiter,getStudentsByClassSection);
router.get(
  "/teacher/classes/:classId/students",
  isAuthenticated,
  authorizeRoles("teacher"),
  getClassTeacherStudents,
);
router.post(
  "/teacher/classes/:classId/students",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  createClassTeacherStudent,
);
router.delete(
  "/teacher/classes/:classId/students/:studentId",
  isAuthenticated,
  authorizeRoles("teacher"),
  archiveClassTeacherStudent,
);
router.get(
  "/teacher/students/:studentId/overview",
  isAuthenticated,
  authorizeRoles("teacher"),
  getClassTeacherStudentOverview,
);
router.put("/:id",emailLimiter, updateStudent);
router.delete("/:id", deleteStudent);
export default router;
