import mongoose from "mongoose";

export const DEPLOYMENT_STATUSES = ["queued", "building", "deploying", "live", "failed", "superseded"];
export const DEPLOYMENT_KINDS = ["deploy", "promote", "rollback"];
export const TERMINAL_STATUSES = ["live", "failed", "superseded"];

const stepSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, trim: true, maxlength: 40 },
        name: { type: String, required: true, trim: true, maxlength: 120 },
        status: { type: String, required: true, enum: ["pending", "running", "succeeded", "failed"], default: "pending" },
        attempts: { type: Number, default: 0, min: 0 },
        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },
        detail: { type: String, default: "", trim: true, maxlength: 300 },
    },
    { _id: false },
);

const deploymentSchema = new mongoose.Schema(
    {
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
        environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Environment", required: true, index: true },
        releaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Release", required: true },
        previousReleaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Release", default: null },
        kind: { type: String, required: true, enum: DEPLOYMENT_KINDS, default: "deploy" },
        status: { type: String, required: true, enum: DEPLOYMENT_STATUSES, default: "queued", index: true },
        steps: { type: [stepSchema], default: [] },
        requestKey: { type: String, required: true, trim: true, minlength: 8, maxlength: 120 },
        triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
        queuedAt: { type: Date, default: Date.now },
        finishedAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false },
);

// The idempotency key. A repeated request carrying the same key returns the first deployment
// instead of queueing a second one.
deploymentSchema.index({ requestKey: 1 }, { unique: true });
deploymentSchema.index({ environmentId: 1, queuedAt: -1 });

export const Deployment = mongoose.model("Deployment", deploymentSchema);
