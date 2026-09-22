import mongoose from "mongoose";

export const JOB_STATUSES = ["pending", "running", "succeeded", "failed"];

/**
 * The background queue, in MongoDB. No broker and no queue library: a job is a document, the
 * worker claims one with an atomic findOneAndUpdate, and a lease makes a crashed or restarted
 * worker's job reclaimable instead of stranded. Backoff is stored as `nextRunAt`, so a retry
 * is simply a job that is not yet due.
 */
const jobSchema = new mongoose.Schema(
    {
        kind: { type: String, required: true, trim: true, maxlength: 40 },
        deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Deployment", required: true, index: true },
        status: { type: String, required: true, enum: JOB_STATUSES, default: "pending" },
        attempts: { type: Number, default: 0, min: 0 },
        maxAttempts: { type: Number, default: 4, min: 1, max: 20 },
        nextRunAt: { type: Date, default: Date.now },
        leaseExpiresAt: { type: Date, default: null },
        lockedBy: { type: String, default: null, trim: true, maxlength: 80 },
        lastError: { type: String, default: "", trim: true, maxlength: 300 },
    },
    { timestamps: true, versionKey: false },
);

jobSchema.index({ status: 1, nextRunAt: 1 });

export const Job = mongoose.model("Job", jobSchema);
