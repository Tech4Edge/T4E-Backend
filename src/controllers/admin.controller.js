import crypto from "crypto";
import Application, { APPLICATION_STATUSES } from "../models/application.model.js";
import Job from "../models/job.model.js";
import { sendMail } from "../config/mailer.js";
import { createAdminToken } from "../utils/adminToken.js";
import { escapeHtml, escapeRegex } from "../utils/sanitize.js";
import xlsx from "xlsx";
const safeCompare = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const getDateRangeFilter = (rangeStr) => {
  if (!rangeStr || rangeStr === "all") return {};
  const now = new Date();
  if (rangeStr === "7d") return { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  if (rangeStr === "30d") return { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  if (rangeStr === "90d") return { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
  if (rangeStr === "ytd") return { $gte: new Date(now.getFullYear(), 0, 1) };
  return {};
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
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: ttlHours * 60 * 60 * 1000,
  });

  return res.json({ message: "Logged in successfully" });
};

export const logoutAdmin = (_req, res) => {
  res.clearCookie("t4e_admin_token", { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" 
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

export const getAnalytics = async (req, res) => {
  const { range } = req.query;
  const dateFilter = getDateRangeFilter(range);

  // Hires this month
  const hiresFilter = { status: "Hired" };
  if (Object.keys(dateFilter).length > 0) {
    hiresFilter.hiredAt = dateFilter;
  }
  const hiresCount = await Application.countDocuments(hiresFilter);
  const recentHires = await Application.find(hiresFilter)
    .populate("jobId", "title")
    .sort({ hiredAt: -1 })
    .limit(5);

  // New applications (24h)
  const newAppsFilter = { 
    appliedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
  };
  const newApplications24h = await Application.countDocuments(newAppsFilter);

  // Open positions
  const openPositions = await Job.countDocuments({ 
    isActive: true, 
    $or: [{ closingDate: null }, { closingDate: { $gt: new Date() } }] 
  });

  // Time-to-Hire
  const hiredApps = await Application.find({ status: "Hired", hiredAt: { $exists: true }, appliedAt: { $exists: true } });
  let totalDays = 0;
  for (const app of hiredApps) {
    totalDays += (new Date(app.hiredAt) - new Date(app.appliedAt)) / (1000 * 60 * 60 * 24);
  }
  const avgTimeToHire = hiredApps.length > 0 ? Math.round(totalDays / hiredApps.length) : 0;

  // Pipeline Status
  const statusCounts = await Application.aggregate([
    { $match: Object.keys(dateFilter).length > 0 ? { appliedAt: dateFilter } : {} },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  
  const normalizedCounts = {};
  statusCounts.forEach(s => {
    let status = s._id;
    if (status === "Pending") status = "New";
    if (status === "Reviewing") status = "Under Review";
    if (status === "Accepted") status = "Hired";
    
    if (!normalizedCounts[status]) {
      normalizedCounts[status] = 0;
    }
    normalizedCounts[status] += s.count;
  });

  const totalAppsForRange = Object.values(normalizedCounts).reduce((a, b) => a + b, 0);
  const pipelineBreakdown = Object.entries(normalizedCounts).map(([status, count]) => ({
    status,
    count,
    percentage: totalAppsForRange > 0 ? Math.round((count / totalAppsForRange) * 100) : 0
  }));

  // Top 10 New Applications
  const topAppsFilter = Object.keys(dateFilter).length > 0 ? { appliedAt: dateFilter } : {};
  const topNewApplications = await Application.find(topAppsFilter)
    .populate("jobId", "title")
    .sort({ appliedAt: -1 })
    .limit(10);

  return res.json({
    hiresThisMonth: hiresCount,
    recentHires,
    newApplications24h,
    openPositions,
    avgTimeToHire,
    pipelineBreakdown,
    topNewApplications
  });
};


export const exportApplicationsCsv = async (req, res) => {
  const { status, jobId, search } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (jobId) filter.jobId = jobId;
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { candidateName: { $regex: safeSearch, $options: "i" } },
      { candidateEmail: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const applications = await Application.find(filter)
    .populate("jobId", "title")
    .sort({ appliedAt: -1 });

  const data = applications.map((app) => ({
    "Candidate Name": app.candidateName,
    "Candidate Email": app.candidateEmail,
    "Job Role": app.jobId ? app.jobId.title : "N/A",
    "Applied At": new Date(app.appliedAt).toISOString().split('T')[0],
    "Status": app.status
  }));

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Applications");
  
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=applications.xlsx');
  return res.status(200).send(buffer);
};

export const bulkDeleteApplications = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "No application IDs provided" });
  }

  await Application.deleteMany({ _id: { $in: ids } });
  return res.json({ message: `Successfully deleted ${ids.length} applications` });
};

export const updateApplicationStatus = async (req, res) => {
  const { status } = req.body;

  if (!APPLICATION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  const application = await Application.findById(req.params.id).populate("jobId", "title");
  if (!application) {
    return res.status(404).json({ message: "Application not found" });
  }

  application.status = status;
  if (status === "Hired") {
    application.hiredAt = new Date();
  }
  await application.save();

  const statusesToEmail = ["Under Review", "Interview", "Offer", "Hired", "Rejected"];

  if (statusesToEmail.includes(status)) {
    const safeCandidateName = escapeHtml(application.candidateName);
    const safeJobTitle = escapeHtml(application.jobId?.title || "Tech4Edges Role");
    
    let emailHtml = "";
    if (status === "Rejected") {
      emailHtml = `
        <p>Hi ${safeCandidateName},</p>
        <p>Thank you for applying for the <strong>${safeJobTitle}</strong> position.</p>
        <p>Unfortunately, we have decided to move forward with other candidates at this time. We will keep your resume on file for future opportunities.</p>
        <p>Best wishes,<br />Tech4Edges Recruitment Team</p>
      `;
    } else if (status === "Interview") {
      emailHtml = `
        <p>Hi ${safeCandidateName},</p>
        <p>Thank you for applying for the <strong>${safeJobTitle}</strong> position. We would like to invite you to an interview.</p>
        <p>Our team will be in touch shortly to schedule a time.</p>
        <p>Thanks,<br />Tech4Edges Recruitment Team</p>
      `;
    } else if (status === "Hired") {
      emailHtml = `
        <p>Hi ${safeCandidateName},</p>
        <p>Congratulations! We are thrilled to offer you the <strong>${safeJobTitle}</strong> position.</p>
        <p>Our HR team will reach out shortly with the formal offer details.</p>
        <p>Welcome to Tech4Edges,<br />Tech4Edges Recruitment Team</p>
      `;
    } else if (status === "Offer") {
      emailHtml = `
        <p>Hi ${safeCandidateName},</p>
        <p>We are excited to move forward and extend an offer for the <strong>${safeJobTitle}</strong> position.</p>
        <p>Please check your emails for the detailed offer letter and next steps.</p>
        <p>Best regards,<br />Tech4Edges Recruitment Team</p>
      `;
    } else if (status === "Under Review") {
      emailHtml = `
        <p>Hi ${safeCandidateName},</p>
        <p>We wanted to let you know that your application for the <strong>${safeJobTitle}</strong> position is currently under review by our hiring team.</p>
        <p>We will be in touch as soon as we have an update.</p>
        <p>Thanks,<br />Tech4Edges Recruitment Team</p>
      `;
    }

    try {
      await sendMail({
        to: application.candidateEmail,
        subject: `Application Update - ${safeJobTitle}`,
        html: emailHtml,
      });
    } catch (error) {
      console.error("Non-critical error: Failed to send status update email", error);
    }
  }

  return res.json({
    message: `Application marked as ${status}`,
    application,
  });
};
