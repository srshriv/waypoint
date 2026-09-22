import mongoose from "mongoose";
import { ROLES } from "../../shared/constants/roles.js";

const memberSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true, maxlength: 120 },
		email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
		role: { type: String, required: true, enum: ROLES, index: true },
		avatarColor: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
		title: { type: String, default: "", trim: true, maxlength: 120 },
		isProfile: { type: Boolean, default: false, index: true },
		sortOrder: { type: Number, default: 0 },
	},
	{ timestamps: true, versionKey: false },
);

memberSchema.index({ email: 1 }, { unique: true });
memberSchema.index({ name: 1 });

export const Member = mongoose.model("Member", memberSchema);
