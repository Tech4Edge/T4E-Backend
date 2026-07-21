import mongoose from "mongoose";

const APPLICATION_STATUSES = ["New", "Under Review", "Interview", "Offer", "Hired", "Rejected"];

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  candidateName: { type: String, required: true },
  candidateEmail: { type: String, required: true },
  responses: { type: Map, of: mongoose.Schema.Types.Mixed },
  cvUrl: { type: String, required: true },
  status: {
    type: String,
    enum: APPLICATION_STATUSES,
    default: "New",
  },
  appliedAt: { type: Date, default: Date.now },
  hiredAt: { type: Date },
});

applicationSchema.index({ jobId: 1, candidateEmail: 1 }, { unique: true });
applicationSchema.index({ status: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ appliedAt: -1 });

const Application = mongoose.model("Application", applicationSchema);
export { APPLICATION_STATUSES };
export default Application;
