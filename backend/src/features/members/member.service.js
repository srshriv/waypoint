import { memberRepository } from "./member.repository.js";

export const memberService = {
    listProfiles: (ids) => memberRepository.listProfiles(ids),
    findProfileById: (id) => memberRepository.findProfileById(id),
};
