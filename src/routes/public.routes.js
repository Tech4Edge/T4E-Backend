import { Router } from "express";

import {
  applyToJob,
  getJobById,
  getJobs,
  submitContactForm,
} from "../controllers/public.controller.js";
import { upload, validateFileBytes } from "../middleware/upload.js";
import { applyRateLimiter, contactRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.get("/jobs", getJobs);
router.get("/jobs/:id", getJobById);
router.post("/apply", applyRateLimiter, upload.single("cv"), validateFileBytes, applyToJob);
router.post("/contact", contactRateLimiter, submitContactForm);

export default router;
