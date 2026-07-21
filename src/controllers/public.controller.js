import Application from "../models/application.model.js";
import Job from "../models/job.model.js";
import { sendMail } from "../config/mailer.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { escapeHtml, escapeRegex, isValidEmail } from "../utils/sanitize.js";

export const getJobs = async (req, res) => {
  const { type, location, search } = req.query;

  const filter = { 
    isActive: true, 
    $or: [{ closingDate: null }, { closingDate: { $gt: new Date() } }] 
  };

  if (type) {
    filter.type = type;
  }
  if (location) {
    filter.location = location;
  }
  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const jobs = await Job.find(filter).sort({ postedDate: -1 });
  res.json(jobs);
};

export const getJobById = async (req, res) => {
  const job = await Job.findOne({ _id: req.params.id, isActive: true });
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }
  return res.json(job);
};

export const applyToJob = async (req, res) => {
  const { jobId, candidateName, candidateEmail } = req.body;
  const file = req.file;

  if (!jobId || !candidateName || !candidateEmail) {
    return res
      .status(400)
      .json({ message: "jobId, candidateName and candidateEmail are required" });
  }
  if (!isValidEmail(candidateEmail)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  if (!file) {
    return res.status(400).json({ message: "CV file is required" });
  }

  const safeCandidateName = escapeHtml(candidateName).substring(0, 200);
  const safeCandidateEmail = String(candidateEmail).substring(0, 320).toLowerCase();

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return res.status(500).json({
      message: "CV upload service is not configured on server",
    });
  }

  const job = await Job.findById(jobId);
  if (!job || !job.isActive) {
    return res.status(404).json({ message: "Active job not found" });
  }

  const existingApplication = await Application.findOne({
    jobId: job._id,
    candidateEmail: safeCandidateEmail,
  });
  if (existingApplication) {
    const msg =
      existingApplication.status === "Rejected"
        ? "You have already applied to this role and your application was not successful. You may not re-apply."
        : "You have already submitted an application for this role.";
    return res.status(409).json({ message: msg });
  }

  let cloudinaryResult;
  try {
    cloudinaryResult = await uploadBufferToCloudinary(file.buffer, file.originalname);
  } catch (_error) {
    return res.status(500).json({
      message: "Could not upload CV file. Please try again.",
    });
  }

  let dynamicResponses = {};
  if (req.body.responses) {
    try {
      dynamicResponses = JSON.parse(req.body.responses);
    } catch (_error) {
      return res.status(400).json({ message: "Invalid responses JSON format" });
    }
  }

  try {
    const application = await Application.create({
      jobId,
      candidateName: safeCandidateName,
      candidateEmail: safeCandidateEmail,
      responses: dynamicResponses,
      cvUrl: cloudinaryResult.secure_url,
    });

    try {
      await sendMail({
        to: safeCandidateEmail,
        subject: `Application Received - ${job.title}`,
        html: `
          <p>Hi ${safeCandidateName},</p>
          <p>We have received your application for <strong>${job.title}</strong>.</p>
          <p>Our hiring team will review your profile and update you soon.</p>
          <p>Thanks,<br />Tech4Edges</p>
        `,
      });
    } catch (mailError) {
      console.error("Non-critical error: Failed to send confirmation email", mailError);
    }

    return res.status(201).json({
      message: "Application submitted successfully",
      applicationId: application._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Application already exists for this role." });
    }
    throw err;
  }
};

export const submitContactForm = async (req, res) => {
  const { firstName, lastName, email, phone, message, agreeToPrivacy } = req.body;

  if (!firstName || !lastName || !email || !message) {
    return res.status(400).json({
      message: "firstName, lastName, email and message are required",
    });
  }

  if (!agreeToPrivacy) {
    return res.status(400).json({ message: "Privacy policy consent is required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const safeFirstName = escapeHtml(firstName).substring(0, 100);
  const safeLastName = escapeHtml(lastName).substring(0, 100);
  const safeEmail = escapeHtml(email).substring(0, 320);
  const safePhone = escapeHtml(phone).substring(0, 50);
  const safeMessage = escapeHtml(message).substring(0, 2000);

  const contactRecipient =
    process.env.CONTACT_FORM_TO_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!contactRecipient) {
    return res.status(500).json({
      message: "Contact recipient email is not configured on server",
    });
  }

  await sendMail({
    to: contactRecipient,
    subject: `New Contact Message from ${safeFirstName} ${safeLastName}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${safeFirstName} ${safeLastName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone || "N/A"}</p>
      <p><strong>Message:</strong></p>
      <p>${safeMessage}</p>
    `,
  });

  return res.status(200).json({ message: "Message sent successfully" });
};
