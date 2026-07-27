import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only PDF and DOC/DOCX files are allowed"));
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

/**
 * Magic-byte guard — call AFTER multer.single() in the route.
 * Rejects the request if the actual file bytes don't match an allowed type.
 */
export const validateFileBytes = async (req, res, next) => {
  if (!req.file) return next();
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    return res.status(400).json({
      message: "File content does not match an allowed type (PDF or DOC/DOCX)",
    });
  }
  next();
};
