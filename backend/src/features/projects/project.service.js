import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { projectRepository } from "./project.repository.js";

const notFound = () => new AppError(404, "PROJECT_NOT_FOUND", "The requested project does not exist.");

function ensureId(id) {
	if (!mongoose.isValidObjectId(id)) throw notFound();
}

function duplicateConflict(error) {
	if (error?.code !== 11000) return null;
	if (error.keyPattern?.slug) return new AppError(409, "PROJECT_SLUG_CONFLICT", "A project with this slug already exists.");
	return new AppError(409, "PROJECT_NAME_CONFLICT", "A project with this name already exists.");
}

async function ensureAvailable({ name, slug }, excludedId, ownerId) {
	if (name && (await projectRepository.findByName(name, excludedId, ownerId))) {
		throw new AppError(409, "PROJECT_NAME_CONFLICT", "A project with this name already exists.");
	}
	if (slug && (await projectRepository.findBySlug(slug, excludedId, ownerId))) {
		throw new AppError(409, "PROJECT_SLUG_CONFLICT", "A project with this slug already exists.");
	}
}

async function loadOwned(id, ownerId) {
	ensureId(id);
	const project = await projectRepository.findById(id, ownerId);
	if (!project) throw notFound();
	return project;
}

export const projectService = {
	list: (ownerId, status) => projectRepository.list(ownerId, status),
	async create(input, ownerId) {
		await ensureAvailable(input, undefined, ownerId);
		try {
			return await projectRepository.create({ ...input, ...(ownerId ? { ownerId } : {}), archivedAt: null });
		} catch (error) {
			throw duplicateConflict(error) || error;
		}
	},
	async update(id, input, ownerId) {
		const existing = await loadOwned(id, ownerId);
		if (existing.archivedAt) throw new AppError(409, "PROJECT_ARCHIVED", "Restore this project before editing it.");
		await ensureAvailable(input, id, ownerId);
		let project;
		try {
			project = await projectRepository.update(id, ownerId, input);
		} catch (error) {
			throw duplicateConflict(error) || error;
		}
		if (!project) throw notFound();
		return project;
	},
	async archive(id, ownerId) {
		const existing = await loadOwned(id, ownerId);
		if (existing.archivedAt) throw new AppError(409, "PROJECT_ALREADY_ARCHIVED", "This project is already archived.");
		const project = await projectRepository.setArchivedAt(id, ownerId, new Date());
		if (!project) throw notFound();
		return project;
	},
	async restore(id, ownerId) {
		const existing = await loadOwned(id, ownerId);
		if (!existing.archivedAt) throw new AppError(409, "PROJECT_NOT_ARCHIVED", "This project is already active.");
		const project = await projectRepository.setArchivedAt(id, ownerId, null);
		if (!project) throw notFound();
		return project;
	},
};
