import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { slugify } from "../../shared/utils/format.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function ProjectEditor({ busy = false, error = "", onCancel, onSave, project = null }) {
	const editing = Boolean(project);
	const titleId = `project-editor-${useId().replace(/:/g, "")}`;
	const [name, setName] = useState(project?.name || "");
	const [slug, setSlug] = useState(project?.slug || "");
	const [slugTouched, setSlugTouched] = useState(editing);
	const [description, setDescription] = useState(project?.description || "");
	const [repositoryUrl, setRepositoryUrl] = useState(project?.repositoryUrl || "");
	const [validation, setValidation] = useState("");

	const changeName = (value) => {
		setName(value);
		if (!slugTouched) setSlug(slugify(value));
	};
	const submit = (event) => {
		event.preventDefault();
		const trimmedName = name.trim();
		const trimmedSlug = slug.trim().toLowerCase();
		const trimmedUrl = repositoryUrl.trim();
		if (!trimmedName) return setValidation("Give the project a name.");
		if (!SLUG_PATTERN.test(trimmedSlug)) return setValidation("The slug must use lowercase letters, numbers, and single hyphens.");
		if (trimmedUrl && !/^https?:\/\/\S+$/i.test(trimmedUrl))
			return setValidation("Provide an http or https repository URL, or leave it empty.");
		setValidation("");
		return onSave({ name: trimmedName, slug: trimmedSlug, description: description.trim(), repositoryUrl: trimmedUrl });
	};

	return createPortal(
		<Modal
			className="project-editor-modal"
			labelledBy={titleId}
			onClose={() => {
				if (!busy) onCancel();
			}}
		>
			<form className="project-editor" onSubmit={submit}>
				<header className="modal-header">
					<h2 id={titleId}>{editing ? "Edit project" : "New project"}</h2>
					<button aria-label="Close" className="icon-button" disabled={busy} type="button" onClick={onCancel}>
						<MaterialIcon size={20}>close</MaterialIcon>
					</button>
				</header>
				<div className="project-editor-body">
					<label className="field">
						<span>Name</span>
						<input
							data-autofocus
							disabled={busy}
							maxLength={80}
							required
							value={name}
							onChange={(event) => changeName(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>Slug</span>
						<input
							disabled={busy}
							maxLength={60}
							required
							value={slug}
							onChange={(event) => {
								setSlugTouched(true);
								setSlug(event.target.value);
							}}
						/>
						<small>Used in deployment targets and URLs. Lowercase letters, numbers, and hyphens.</small>
					</label>
					<label className="field">
						<span>Description</span>
						<textarea
							disabled={busy}
							maxLength={1000}
							rows={3}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>Repository URL</span>
						<input
							disabled={busy}
							inputMode="url"
							maxLength={500}
							placeholder="https://github.com/org/repo"
							value={repositoryUrl}
							onChange={(event) => setRepositoryUrl(event.target.value)}
						/>
					</label>
					{(validation || error) && (
						<p className="field-error" role="alert">
							{validation || error}
						</p>
					)}
				</div>
				<footer className="project-editor-footer">
					<button disabled={busy} type="button" onClick={onCancel}>
						Cancel
					</button>
					<button className="primary-button" disabled={busy} type="submit">
						{busy ? "Saving…" : editing ? "Save changes" : "Create project"}
					</button>
				</footer>
			</form>
		</Modal>,
		document.body,
	);
}
