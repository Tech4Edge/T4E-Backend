import { Router } from "express";

import {
  createJob,
  deleteJob,
  getJobsAdmin,
  getApplications,
  loginAdmin,
  logoutAdmin,
  getAdminMe,
  updateJob,
  updateApplicationStatus,
  getAnalytics,
  exportApplicationsCsv,
  bulkDeleteApplications
} from "../controllers/admin.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/login", loginRateLimiter, loginAdmin);
router.post("/logout", logoutAdmin);
router.get("/me", adminAuth, getAdminMe);
router.use(adminAuth);
router.get("/analytics", getAnalytics);
router.get("/jobs", getJobsAdmin);
router.post("/jobs", createJob);
router.patch("/jobs/:id", updateJob);
router.delete("/jobs/:id", deleteJob);
router.get("/applications/export", exportApplicationsCsv);
router.post("/applications/bulk-delete", bulkDeleteApplications);
router.get("/applications", getApplications);
router.patch("/applications/:id/status", updateApplicationStatus);

export default router;
