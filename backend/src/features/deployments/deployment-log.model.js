import mongoose from "mongoose";

/**
 * Log lines live in their own collection so a long build does not grow the deployment
 * document, and so the console can page through them with a cursor. `sequence` is monotonic
 * per deployment and is what the UI sends back as `after` to fetch only new lines.
 */
const deploymentLogSchema = new mongoose.Schema(
	{
		deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Deployment", required: true, index: true },
		sequence: { type: Number, required: true, min: 1 },
		level: { type: String, required: true, enum: ["info", "warn", "error"], default: "info" },
		message: { type: String, required: true, trim: true, maxlength: 500 },
		stepKey: { type: String, default: "", trim: true, maxlength: 40 },
		createdAt: { type: Date, default: Date.now },
	},
	{ versionKey: false },
);

deploymentLogSchema.index({ deploymentId: 1, sequence: 1 }, { unique: true });

export const DeploymentLog = mongoose.model("DeploymentLog", deploymentLogSchema);
