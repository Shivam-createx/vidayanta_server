import express from "express";
import {
  createResult,
  getMyResults,
  getStudentResults,
  getStudentsResultsSummary,
  deleteResult,
  updateResult
} from "../controllers/resultcontroller.js";
import { emailLimiter } from "../middlerwars/ratelimter.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";
const router = express.Router();

router.post(
  "/create",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  createResult,
);
router.get("/my", getMyResults);
router.get("/student", getStudentResults);
router.get("/students-summary", getStudentsResultsSummary);
router.delete("/:id",deleteResult);
router.put(
  "/:id",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  updateResult,
);
export default router;