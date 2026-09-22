const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatDate(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

export function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}
