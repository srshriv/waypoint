import { Project } from "./project.model.js";

const scopeOf = (ownerId) => (ownerId ? { ownerId } : {});
const statusFilter = (status) => {
    if (status === "archived") return { archivedAt: { $ne: null } };
    if (status === "all") return {};
    return { archivedAt: null };
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const projectRepository = {
    list: (ownerId, status) => Project.find({ ...scopeOf(ownerId), ...statusFilter(status) }).sort({ archivedAt: 1, name: 1 }).lean(),
    findById: (id, ownerId) => Project.findOne({ _id: id, ...scopeOf(ownerId) }).lean(),
    findByName: (name, excludedId, ownerId) => Project.findOne({
        name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
        ...scopeOf(ownerId),
        ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).lean(),
    findBySlug: (slug, excludedId, ownerId) => Project.findOne({
        slug,
        ...scopeOf(ownerId),
        ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).lean(),
    create: (input) => Project.create(input),
    update: (id, ownerId, input) => Project.findOneAndUpdate({ _id: id, ...scopeOf(ownerId) }, input, { new: true, runValidators: true }).lean(),
    setArchivedAt: (id, ownerId, archivedAt) => Project.findOneAndUpdate({ _id: id, ...scopeOf(ownerId) }, { $set: { archivedAt } }, { new: true, runValidators: true }).lean(),
};
