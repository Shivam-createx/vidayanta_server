import express from "express";
import {
  createAnnouncement,
  createTeacherClassAnnouncement,
  updateTeacherAnnouncement,
  deleteTeacherAnnouncement,
  getTeacherAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getAnnouncementById
} from "../controllers/announcementcontroller.js";
import { emailLimiter } from "../middlerwars/ratelimter.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";
const router = express.Router();

router.post("/create", emailLimiter ,createAnnouncement);
router.post(
  "/teacher/class",
  emailLimiter,
  isAuthenticated,
  authorizeRoles("teacher"),
  createTeacherClassAnnouncement,
);
router.put(
  "/teacher/:id",
  isAuthenticated,
  authorizeRoles("teacher"),
  updateTeacherAnnouncement,
);
router.delete(
  "/teacher/:id",
  isAuthenticated,
  authorizeRoles("teacher"),
  deleteTeacherAnnouncement,
);
router.get("/teacher", getTeacherAnnouncements);
router.put("/:id",emailLimiter , updateAnnouncement);
router.delete("/:id", deleteAnnouncement);
router.get("/get", getAnnouncements);
router.get("/:id", getAnnouncementById);

export default router;