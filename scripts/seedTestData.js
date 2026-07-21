import dotenv from "dotenv";
import mongoose from "mongoose";

import Job from "../src/models/job.model.js";
import Application from "../src/models/application.model.js";

dotenv.config();

const sampleJobs = [
  {
    title: "[TEST] Frontend Engineer (React)",
    location: "Peshawar",
    type: "Full-time",
    description:
      "<p>Build modern interfaces with reusable components and polished UX execution.</p>",
    isActive: true,
    formSchema: [
      { label: "Expected Salary (PKR)", fieldType: "number", required: true },
      { label: "Portfolio URL", fieldType: "text", required: false },
      {
        label: "Notice Period",
        fieldType: "dropdown",
        required: true,
        options: ["Immediate", "15 days", "30 days"],
      },
    ],
  },
  {
    title: "[TEST] Backend Engineer (Node.js)",
    location: "Remote",
    type: "Full-time",
    description:
      "<p>Design APIs and build resilient backend services with clean architecture.</p>",
    isActive: true,
    formSchema: [
      { label: "Current CTC", fieldType: "number", required: true },
      { label: "GitHub Profile", fieldType: "text", required: false },
      {
        label: "Preferred Shift",
        fieldType: "dropdown",
        required: true,
        options: ["Day", "Evening", "Flexible"],
      },
    ],
  },
  {
    title: "[TEST] UI/UX Designer",
    location: "Islamabad",
    type: "Hybrid",
    description:
      "<p>Create high quality product experiences with strong UX research and visual systems.</p>",
    isActive: true,
    formSchema: [
      { label: "Behance/Dribbble URL", fieldType: "text", required: true },
      {
        label: "Design Tool Expertise",
        fieldType: "dropdown",
        required: true,
        options: ["Figma", "Adobe XD", "Sketch"],
      },
    ],
  },
  {
    title: "[TEST] MERN Stack Developer",
    location: "Lahore",
    type: "Hybrid",
    description:
      "<p>End-to-end web application development using MongoDB, Express, React, and Node.js.</p>",
    isActive: true,
    formSchema: [
      { label: "Years of MERN Experience", fieldType: "number", required: true },
      { label: "LinkedIn Profile", fieldType: "text", required: true },
    ],
  },
  {
    title: "[TEST] Digital Marketing Specialist",
    location: "Peshawar",
    type: "Part-time",
    description:
      "<p>Manage ad campaigns, SEO, and social media presence.</p>",
    isActive: false,
    formSchema: [
      { label: "Previous Campaign Spend Managed", fieldType: "number", required: false },
    ],
  },
];

const buildApplications = (jobs) => {
  const frontendJob = jobs.find((job) => job.title.includes("Frontend Engineer"));
  const backendJob = jobs.find((job) => job.title.includes("Backend Engineer"));
  const designerJob = jobs.find((job) => job.title.includes("UI/UX Designer"));
  const mernJob = jobs.find((job) => job.title.includes("MERN Stack"));

  return [
    {
      jobId: frontendJob?._id,
      candidateName: "Ayesha Khan",
      candidateEmail: "ayesha.khan@example.com",
      responses: {
        "Expected Salary (PKR)": 220000,
        "Portfolio URL": "https://portfolio.example.com/ayesha",
        "Notice Period": "30 days",
      },
      cvUrl: "https://example.com/cv-ayesha.pdf",
      status: "New",
    },
    {
      jobId: frontendJob?._id,
      candidateName: "Usman Tariq",
      candidateEmail: "usman.t@example.com",
      responses: {
        "Expected Salary (PKR)": 250000,
        "Portfolio URL": "https://usmantariq.dev",
        "Notice Period": "Immediate",
      },
      cvUrl: "https://example.com/cv-usman.pdf",
      status: "Under Review",
    },
    {
      jobId: backendJob?._id,
      candidateName: "Bilal Ahmed",
      candidateEmail: "bilal.ahmed@example.com",
      responses: {
        "Current CTC": 260000,
        "GitHub Profile": "https://github.com/bilalahmed",
        "Preferred Shift": "Flexible",
      },
      cvUrl: "https://example.com/cv-bilal.pdf",
      status: "Hired",
      hiredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      jobId: designerJob?._id,
      candidateName: "Sara Ali",
      candidateEmail: "sara.ali@example.com",
      responses: {
        "Behance/Dribbble URL": "https://dribbble.com/sara",
        "Design Tool Expertise": "Figma",
      },
      cvUrl: "https://example.com/cv-sara.pdf",
      status: "Rejected",
    },
    {
      jobId: mernJob?._id,
      candidateName: "Ali Raza",
      candidateEmail: "ali.raza@example.com",
      responses: {
        "Years of MERN Experience": 3,
        "LinkedIn Profile": "https://linkedin.com/in/aliraza",
      },
      cvUrl: "https://example.com/cv-ali.pdf",
      status: "Under Review",
    },
    {
      jobId: mernJob?._id,
      candidateName: "Hina Rabbani",
      candidateEmail: "hina.r@example.com",
      responses: {
        "Years of MERN Experience": 5,
        "LinkedIn Profile": "https://linkedin.com/in/hina-r",
      },
      cvUrl: "https://example.com/cv-hina.pdf",
      status: "New",
    },
  ].filter((application) => Boolean(application.jobId));
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required in backend/.env");
  }

  await mongoose.connect(mongoUri);

  const existingTestJobs = await Job.find({ title: { $regex: "^\\[TEST\\]" } });
  const existingTestJobIds = existingTestJobs.map((job) => job._id);

  if (existingTestJobIds.length > 0) {
    await Application.deleteMany({ jobId: { $in: existingTestJobIds } });
    await Job.deleteMany({ _id: { $in: existingTestJobIds } });
  }

  const createdJobs = await Job.insertMany(sampleJobs);
  const createdApplications = await Application.insertMany(buildApplications(createdJobs));

  console.log("Test jobs created:", createdJobs.length);
  console.log("Test applications created:", createdApplications.length);
  console.log(
    "Job IDs:",
    createdJobs.map((job) => ({ title: job.title, id: job._id.toString() })),
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
