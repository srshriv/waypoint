import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
	{
		ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", index: true },
		name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
		slug: {
			type: String,
			required: true,
			trim: true,
			lowercase: true,
			minlength: 1,
			maxlength: 60,
			match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		},
		description: { type: String, default: "", trim: true, maxlength: 1000 },
		repositoryUrl: { type: String, default: "", trim: true, maxlength: 500 },
		archivedAt: { type: Date, default: null },
	},
	{ timestamps: true, versionKey: false },
);

projectSchema.index({ ownerId: 1, slug: 1 }, { unique: true });
projectSchema.index({ ownerId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Project = mongoose.model("Project", projectSchema);
