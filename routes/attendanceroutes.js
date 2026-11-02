import express from "express";
import { emailLimiter } from "../middlerwars/ratelimter.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";
import {
  getStudentsForAttendance,
  uploadAttendance,
  getMyAttendance,
  getStudentAttendance,
  getStudentsAttendanceInstitution,
  getStudentAttendanceDetails,
  updateAttendance,
  deleteAttendance
} from "../controllers/attendancecontroller.js";

const router = express.Router();

router.post("/students",emailLimiter, getStudentsForAttendance);
router.post(
  "/create",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  uploadAttendance,
);
router.get("/my",getMyAttendance);
router.get("/student" ,getStudentAttendance);
router.get("/students-attendance",getStudentsAttendanceInstitution);
router.get("/student-details", getStudentAttendanceDetails);
router.put(
  "/update/:id",
  isAuthenticated,
  authorizeRoles("teacher"),
  updateAttendance,
);
router.delete("/delete/:id", deleteAttendance)
export default router;