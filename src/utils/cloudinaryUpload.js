import cloudinary from "../config/cloudinary.js";
import crypto from "crypto";

export const uploadBufferToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "tech4edges/cvs",
        public_id: `${crypto.randomUUID()}-${filename}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};
