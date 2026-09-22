export const ROLE_LABELS = {
    releaseManager: "Release manager",
    contributor: "Contributor",
};

export const roleLabel = (role) => ROLE_LABELS[role] || "Member";
