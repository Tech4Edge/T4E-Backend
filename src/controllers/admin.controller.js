import crypto from "crypto";
import Application, { APPLICATION_STATUSES } from "../models/application.model.js";
import Job from "../models/job.model.js";
import { sendMail } from "../config/mailer.js";
import { createAdminToken } from "../utils/adminToken.js";
import { escapeHtml, escapeRegex } from "../utils/sanitize.js";

const safeCompare = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const loginAdmin = async (req, res) => {
  const { username, password } = req.body;
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return res
      .status(500)
      .json({ message: "ADMIN_USERNAME and ADMIN_PASSWORD must be configured" });
  }

  if (username !== configuredUsername || !safeCompare(password, configuredPassword)) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  const token = createAdminToken();
  const ttlHours = Number(process.env.ADMIN_TOKEN_TTL_HOURS || 12);
  
  res.cookie("t4e_admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ttlHours * 60 * 60 * 1000,
  });

  return res.json({ message: "Logged in successfully" });
};

export const logoutAdmin = (_req, res) => {
  res.clearCookie("t4e_admin_token", { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "strict" 
  });
  return res.json({ message: "Logged out" });
};

export const getAdminMe = (_req, res) => {
  return res.json({ authenticated: true, role: "admin" });
};

export const getJobsAdmin = async (_req, res) => {
  const jobs = await Job.find().sort({ postedDate: -1 });
  return res.json(jobs);
};

export const createJob = async (req, res) => {
  const { title, location, type, description, isActive, formSchema } = req.body;

  if (!title) {
    return res.status(400).json({ message: "Job title is required" });
  }

  const createdJob = await Job.create({
    title,
    location,
    type,
    description,
    isActive: isActive ?? true,
    formSchema: Array.isArray(formSchema) ? formSchema : [],
  });

  return res.status(201).json(createdJob);
};

export const updateJob = async (req, res) => {
  const { title, location, type, description, isActive, formSchema } = req.body;

  if (!title) {
    return res.status(400).json({ message: "Job title is required" });
  }

  const job = await Job.findById(req.params.id);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  job.title = title;
  job.location = location;
  job.type = type;
  job.description = description;
  job.isActive = typeof isActive === "boolean" ? isActive : job.isActive;
  
  if ("formSchema" in req.body) {
    job.formSchema = Array.isArray(formSchema) ? formSchema : [];
  }

  await job.save();
  return res.json(job);
};

export const deleteJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  const linkedApplications = await Application.countDocuments({ jobId: job._id });
  if (linkedApplications > 0) {
    return res.status(400).json({
      message:
        "Cannot delete this job because applications are linked. Set it inactive instead.",
    });
  }

  await job.deleteOne();
  return res.json({ message: "Job deleted successfully" });
};

export const getApplications = async (req, res) => {
  const { status, jobId, search } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }
  if (jobId) {
    filter.jobId = jobId;
  }
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { candidateName: { $regex: safeSearch, $options: "i" } },
      { candidateEmail: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .populate("jobId", "title type location")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  return res.json({ applications, total, page, pages: Math.ceil(total / limit) });
};

export const updateApplicationStatus = async (req, res) => {
  const { status } = req.body;

  const terminalStatuses = ["Accepted", "Rejected"];
  
  if (!APPLICATION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  const application = await Application.findById(req.params.id).populate("jobId", "title");
  if (!application) {
    return res.status(404).json({ message: "Application not found" });
  }

  application.status = status;
  await application.save();

  if (terminalStatuses.includes(status)) {
    const safeCandidateName = escapeHtml(application.candidateName);
    const safeJobTitle = escapeHtml(application.jobId?.title || "Tech4Edges Role");

    await sendMail({
      to: application.candidateEmail,
      subject: `Application ${status} - ${safeJobTitle}`,
      html: `
        <p>Hi ${safeCandidateName},</p>
        <p>Your application status has been updated to <strong>${status}</strong>.</p>
        <p>Role: ${safeJobTitle}</p>
        <p>Thanks,<br />Tech4Edges Recruitment Team</p>
      `,
    });
  }

  return res.json({
    message: `Application marked as ${status}`,
    application,
  });
};
