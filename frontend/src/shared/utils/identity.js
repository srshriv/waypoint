export function identityInitials(name = "") {
	const parts = String(name).trim().split(/\s+/).filter(Boolean);
	return parts
		.slice(0, 2)
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}
