import express from "express";
import { emailLimiter } from "../middlerwars/ratelimter.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";
import { createHomework , getHomeworkByClass ,getHomeworkByTeacher,getMyHomework,deleteHomework,updateHomework,getStudentHomework} from "../controllers/homeworkcontroller.js";
const router = express.Router();
router.post(
  "/create",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  createHomework,
);
router.get("/class", getHomeworkByClass);
router.get("/teacher", getHomeworkByTeacher);
router.get("/my", getMyHomework);
router.delete(
  "/delete/:id",
  isAuthenticated,
  authorizeRoles("teacher"),
  deleteHomework,
);
router.put(
  "/update/:id",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  updateHomework,
);
router.get("/student", getStudentHomework);
export default router;