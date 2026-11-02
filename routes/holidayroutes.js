import express from "express";
import {
  createInstitutionHoliday,
  deleteInstitutionHoliday,
  getInstitutionHolidays,
  updateInstitutionHoliday,
} from "../controllers/holidaycontroller.js";
import { isAuthenticated, authorizeRoles } from "../middlerwars/authmiddlerwars.js";

const router = express.Router();

router.use(isAuthenticated);
router.get("/", authorizeRoles("instituteadmin", "teacher", "student"), getInstitutionHolidays);
router.post("/", authorizeRoles("instituteadmin"), createInstitutionHoliday);
router.put("/:id", authorizeRoles("instituteadmin"), updateInstitutionHoliday);
router.delete("/:id", authorizeRoles("instituteadmin"), deleteInstitutionHoliday);

export default router;
