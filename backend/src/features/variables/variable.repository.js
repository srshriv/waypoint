import { Variable } from "./variable.model.js";

export const variableRepository = {
	/** Loads values because non-secrets are returned in full; the service masks the rest. */
	listByEnvironment: (environmentId) => Variable.find({ environmentId }).select("+value").sort({ key: 1 }).lean(),
	/** Existence and ownership checks only. Deliberately does not load the value. */
	findById: (id, environmentId) => Variable.findOne({ _id: id, ...(environmentId ? { environmentId } : {}) }).lean(),
	/** The only read that hands back a secret in the clear. Used by reveal. */
	findByIdWithValue: (id, environmentId) =>
		Variable.findOne({ _id: id, ...(environmentId ? { environmentId } : {}) })
			.select("+value")
			.lean(),
	findByKey: (environmentId, key, excludedId) =>
		Variable.findOne({
			environmentId,
			key,
			...(excludedId ? { _id: { $ne: excludedId } } : {}),
		}).lean(),
	countByEnvironment: (environmentId) => Variable.countDocuments({ environmentId }),
	create: (input) => Variable.create(input),
	update: (id, environmentId, input) =>
		Variable.findOneAndUpdate({ _id: id, environmentId }, input, { new: true, runValidators: true }).select("+value").lean(),
	remove: (id, environmentId) => Variable.findOneAndDelete({ _id: id, environmentId }).lean(),
};
