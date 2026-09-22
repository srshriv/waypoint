import mongoose from "mongoose";

const environmentSchema = new mongoose.Schema(
	{
		projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
		name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
		rank: { type: Number, required: true, min: 0, max: 20 },
		requiresHealthCheck: { type: Boolean, default: true },
		currentReleaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Release", default: null },
		currentDeploymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Deployment", default: null },
		lockedByDeploymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Deployment", default: null },
		lockedAt: { type: Date, default: null },
		leaseExpiresAt: { type: Date, default: null },
	},
	{ timestamps: true, versionKey: false },
);

environmentSchema.index({ projectId: 1, rank: 1 }, { unique: true });
environmentSchema.index({ projectId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Environment = mongoose.model("Environment", environmentSchema);
