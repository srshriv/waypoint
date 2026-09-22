import mongoose from "mongoose";

export const CHANGE_TYPES = ["added", "modified", "removed"];

const changeSchema = new mongoose.Schema(
	{
		path: { type: String, required: true, trim: true, maxlength: 300 },
		changeType: { type: String, required: true, enum: CHANGE_TYPES },
	},
	{ _id: false },
);

/**
 * A release is an immutable build artifact: the record of what was built from a commit. It is
 * created once and never edited, so deployments across every environment can all point at the
 * same release and mean the same bytes.
 */
const releaseSchema = new mongoose.Schema(
	{
		projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
		version: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
		commitSha: { type: String, required: true, trim: true, lowercase: true, match: /^[0-9a-f]{7,40}$/ },
		commitMessage: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
		author: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
		changes: { type: [changeSchema], default: [] },
	},
	{ timestamps: true, versionKey: false },
);

releaseSchema.index({ projectId: 1, version: 1 }, { unique: true });
releaseSchema.index({ projectId: 1, createdAt: -1 });

// Immutability enforced rather than merely intended: any update path throws, so a future
// change that tries to edit a release fails loudly instead of silently rewriting history.
const refuseMutation = function refuseMutation(next) {
	next(new Error("Releases are immutable. Cut a new release instead of editing an existing one."));
};
releaseSchema.pre("findOneAndUpdate", refuseMutation);
releaseSchema.pre("updateOne", refuseMutation);
releaseSchema.pre("updateMany", refuseMutation);
releaseSchema.pre("replaceOne", refuseMutation);

export const Release = mongoose.model("Release", releaseSchema);
