import mongoose from "mongoose";

const formFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    fieldType: {
      type: String,
      enum: ["text", "number", "email", "file", "dropdown"],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  },
  { _id: false },
);

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Hybrid", "Remote"];
const OFFICE_LOCATIONS = ["Peshawar", "Islamabad", "Karachi", "Lahore", "Remote", "Hybrid"];

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  location: { type: String, enum: OFFICE_LOCATIONS },
  type: { type: String, enum: JOB_TYPES },
  description: { type: String, maxlength: 50000 },
  isActive: { type: Boolean, default: true },
  postedDate: { type: Date, default: Date.now },
  formSchema: [formFieldSchema],
});

const Job = mongoose.model("Job", jobSchema);
export { JOB_TYPES, OFFICE_LOCATIONS };
export default Job;
