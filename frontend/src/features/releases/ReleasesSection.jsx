import { useCallback, useEffect, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { SelectMenu } from "../../shared/components/SelectMenu.jsx";
import { formatDate } from "../../shared/utils/format.js";
import { projectApi } from "../projects/project.api.js";
import { ReleaseDiff } from "./ReleaseDiff.jsx";
import { ReleaseEditor } from "./ReleaseEditor.jsx";
import { releaseApi } from "./release.api.js";

const PROJECT_STORAGE_KEY = "waypoint-release-project";

export function ReleasesSection({ activeProfile }) {
	const [projects, setProjects] = useState(null);
	const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_STORAGE_KEY) || "");
	const [releases, setReleases] = useState(null);
	const [error, setError] = useState("");
	const [editorOpen, setEditorOpen] = useState(false);
	const [editorError, setEditorError] = useState("");
	const [saving, setSaving] = useState(false);
	const [fromId, setFromId] = useState("");
	const [toId, setToId] = useState("");
	const [diff, setDiff] = useState(null);
	const [diffError, setDiffError] = useState("");
	const [comparing, setComparing] = useState(false);

	const loadProjects = useCallback(async () => {
		try {
			setError("");
			const rows = await projectApi.list("active");
			setProjects(rows);
			setProjectId((current) => (rows.some((row) => row._id === current) ? current : rows[0]?._id || ""));
		} catch (requestError) {
			setError(requestError.message);
			setProjects([]);
		}
	}, []);
	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	const loadReleases = useCallback(async (id) => {
		if (!id) {
			setReleases([]);
			return;
		}
		try {
			setError("");
			setReleases(null);
			setDiff(null);
			setDiffError("");
			const rows = await releaseApi.list(id);
			setReleases(rows);
			// Default the comparison to the two most recent releases, oldest of the pair first.
			setToId(rows[0]?._id || "");
			setFromId(rows[1]?._id || "");
		} catch (requestError) {
			setError(requestError.message);
			setReleases([]);
		}
	}, []);
	useEffect(() => {
		loadReleases(projectId);
	}, [loadReleases, projectId]);

	const create = async (input) => {
		try {
			setSaving(true);
			setEditorError("");
			await releaseApi.create(projectId, input);
			setEditorOpen(false);
			await loadReleases(projectId);
		} catch (requestError) {
			setEditorError(requestError.message);
		} finally {
			setSaving(false);
		}
	};

	const compare = async () => {
		try {
			setComparing(true);
			setDiffError("");
			setDiff(null);
			setDiff(await releaseApi.diff(projectId, fromId, toId));
		} catch (requestError) {
			setDiffError(requestError.message);
		} finally {
			setComparing(false);
		}
	};

	const projectOptions = (projects || []).map((project) => ({ value: project._id, label: project.name }));
	const releaseOptions = (releases || []).map((release) => ({
		value: release._id,
		label: `${release.version} · ${formatDate(release.createdAt)}`,
	}));
	const canCompare = releaseOptions.length >= 2 && fromId && toId && fromId !== toId;

	return (
		<div className="section-stack">
			<div className="section-toolbar">
				<div className="project-picker">
					<span>Project</span>
					{projects === null ? (
						<div className="panel-status inline-status" role="status">
							<span className="profile-loader" />
						</div>
					) : projectOptions.length > 0 ? (
						<SelectMenu
							ariaLabel="Choose a project"
							options={projectOptions}
							value={projectId}
							onChange={(id) => {
								setProjectId(id);
								localStorage.setItem(PROJECT_STORAGE_KEY, id);
							}}
						/>
					) : (
						<span className="picker-empty">No active projects</span>
					)}
				</div>
				<button
					className="primary-button toolbar-action"
					disabled={!projectId}
					type="button"
					onClick={() => {
						setEditorError("");
						setEditorOpen(true);
					}}
				>
					<MaterialIcon size={18}>add</MaterialIcon>Cut a release
				</button>
			</div>

			{error && (
				<div className="panel-error" role="alert">
					<div>
						<strong>Releases couldn’t be loaded</strong>
						<span>{error}</span>
					</div>
					<button type="button" onClick={() => loadReleases(projectId)}>
						Try again
					</button>
				</div>
			)}

			{releases === null && (
				<div className="panel panel-status" role="status">
					<span className="profile-loader" />
					Loading releases…
				</div>
			)}

			{releases !== null && !error && releases.length === 0 && (
				<div className="pending-section">
					<span className="pending-section-icon">
						<MaterialIcon size={28}>history</MaterialIcon>
					</span>
					<h3>No releases yet</h3>
					<p>
						Cut a release to record a build. Deployments reference a release, so this is what gets promoted through the
						environments.
					</p>
				</div>
			)}

			{releases !== null && releases.length > 0 && (
				<>
					<section className="panel" aria-labelledby="compare-title">
						<header className="panel-header">
							<h3 id="compare-title">Compare releases</h3>
							<p>Pick any two releases in this project to see every file that changed between them.</p>
						</header>
						<div className="compare-bar">
							<label className="compare-field">
								<span>From</span>
								<SelectMenu ariaLabel="Compare from release" options={releaseOptions} value={fromId} onChange={setFromId} />
							</label>
							<MaterialIcon className="compare-arrow" size={18}>
								arrow_upward
							</MaterialIcon>
							<label className="compare-field">
								<span>To</span>
								<SelectMenu ariaLabel="Compare to release" options={releaseOptions} value={toId} onChange={setToId} />
							</label>
							<button className="secondary-button" disabled={!canCompare || comparing} type="button" onClick={compare}>
								{comparing ? "Comparing…" : "Compare"}
							</button>
						</div>
						{fromId && toId && fromId === toId && <p className="compare-hint">Pick two different releases to compare.</p>}
						{diffError && (
							<div className="panel-error" role="alert">
								<div>
									<strong>Comparison failed</strong>
									<span>{diffError}</span>
								</div>
								<button type="button" onClick={() => setDiffError("")}>
									Dismiss
								</button>
							</div>
						)}
					</section>

					{diff && <ReleaseDiff diff={diff} />}

					<ul className="release-list">
						{releases.map((release) => (
							<li className="release-card" key={release._id}>
								<div className="release-head">
									<code className="release-version">{release.version}</code>
									<code className="release-sha">{release.commitSha.slice(0, 7)}</code>
									<span className="release-date">{formatDate(release.createdAt)}</span>
								</div>
								<p className="release-message">{release.commitMessage}</p>
								<div className="release-meta">
									<span>{release.author}</span>
									<span>
										{release.changes.length} {release.changes.length === 1 ? "file" : "files"} changed
									</span>
								</div>
								<ul className="release-changes">
									{release.changes.map((change) => (
										<li className={`release-change release-change-${change.changeType}`} key={change.path}>
											<span aria-hidden="true">
												{change.changeType === "added" ? "+" : change.changeType === "removed" ? "−" : "~"}
											</span>
											<code>{change.path}</code>
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</>
			)}

			{editorOpen && (
				<ReleaseEditor
					busy={saving}
					defaultAuthor={activeProfile.name}
					error={editorError}
					onCancel={() => setEditorOpen(false)}
					onSave={create}
				/>
			)}
		</div>
	);
}
