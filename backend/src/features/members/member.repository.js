import { Member } from "./member.model.js";

export const memberRepository = {
    findProfileById: (id) => Member.findOne({ _id: id, isProfile: true }).lean(),
    listProfiles: (ids) => Member.find({ isProfile: true, ...(ids ? { _id: { $in: ids } } : {}) }).sort({ sortOrder: 1, name: 1 }).lean(),
};
