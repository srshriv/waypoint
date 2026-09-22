import mongoose from "mongoose";

export const VARIABLE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

const variableSchema = new mongoose.Schema(
	{
		environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Environment", required: true, index: true },
		key: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 100, match: VARIABLE_KEY_PATTERN },
		// `select: false` mirrors how WorkspaceAccount holds passwordHash: the value is never
		// loaded unless a query asks for it, so a careless read cannot leak a secret.
		value: { type: String, required: true, maxlength: 4000, select: false },
		isSecret: { type: Boolean, default: false },
	},
	{ timestamps: true, versionKey: false },
);

variableSchema.index({ environmentId: 1, key: 1 }, { unique: true });

export const Variable = mongoose.model("Variable", variableSchema);
