import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Application from "../src/models/application.model.js";
import { connectDatabase } from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const STATUS_MAP = {
  "Pending": "New",
  "Reviewed": "Under Review",
  "Shortlisted": "Under Review",
  "Accepted": "Hired",
};

const runMigration = async () => {
  try {
    await connectDatabase();
    console.log("Connected to DB. Starting migration...");

    let totalUpdated = 0;

    for (const [oldStatus, newStatus] of Object.entries(STATUS_MAP)) {
      const result = await Application.updateMany(
        { status: oldStatus },
        { $set: { status: newStatus } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Migrated ${result.modifiedCount} records from '${oldStatus}' to '${newStatus}'.`);
        totalUpdated += result.modifiedCount;
      }
      
      if (oldStatus === "Accepted") {
        const acceptedApps = await Application.find({ status: "Hired", hiredAt: { $exists: false } });
        for (const app of acceptedApps) {
          app.hiredAt = new Date(new Date(app.appliedAt).getTime() + 5 * 24 * 60 * 60 * 1000);
          await app.save();
        }
      }
    }

    console.log(`Migration complete. Total records updated: ${totalUpdated}`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

runMigration();
