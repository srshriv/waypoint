import { useCallback, useEffect, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { SelectMenu } from "../../shared/components/SelectMenu.jsx";
import { formatDate } from "../../shared/utils/format.js";
import { projectApi } from "../projects/project.api.js";
import { EnvironmentEditor } from "./EnvironmentEditor.jsx";
import { environmentApi } from "./environment.api.js";

const PROJECT_STORAGE_KEY = "waypoint-environment-project";

export function EnvironmentsSection({ activeProfile }) {
	const canManage = activeProfile.role === "releaseManager";
	const [projects, setProjects] = useState(null);
	const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_STORAGE_KEY) || "");
	const [projectError, setProjectError] = useState("");
	const [environments, setEnvironments] = useState(null);
	const [error, setError] = useState("");
	const [actionError, setActionError] = useState("");
	const [busyId, setBusyId] = useState("");
	const [reordering, setReordering] = useState(false);
	const [editor, setEditor] = useState(null);
	const [editorError, setEditorError] = useState("");
	const [saving, setSaving] = useState(false);

	const loadProjects = useCallback(async () => {
		try {
			setProjectError("");
			setProjects(null);
			const rows = await projectApi.list("active");
			setProjects(rows);
			setProjectId((current) => (rows.some((row) => row._id === current) ? current : rows[0]?._id || ""));
		} catch (requestError) {
			setProjectError(requestError.message);
			setProjects([]);
		}
	}, []);
	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	const loadEnvironments = useCallback(async (id) => {
		if (!id) {
			setEnvironments([]);
			return;
		}
		try {
			setError("");
			setEnvironments(null);
			setEnvironments(await environmentApi.list(id));
		} catch (requestError) {
			setError(requestError.message);
			setEnvironments([]);
		}
	}, []);
	useEffect(() => {
		loadEnvironments(projectId);
	}, [loadEnvironments, projectId]);

	const selectProject = (id) => {
		setProjectId(id);
		localStorage.setItem(PROJECT_STORAGE_KEY, id);
		setActionError("");
	};

	const save = async (input) => {
		try {
			setSaving(true);
			setEditorError("");
			if (editor.environment) await environmentApi.update(projectId, editor.environment._id, input);
			else await environmentApi.create(projectId, input);
			setEditor(null);
			await loadEnvironments(projectId);
		} catch (requestError) {
			setEditorError(requestError.message);
		} finally {
			setSaving(false);
		}
	};

	const toggleHealthCheck = async (environment) => {
		try {
			setActionError("");
			setBusyId(environment._id);
			await environmentApi.update(projectId, environment._id, { requiresHealthCheck: !environment.requiresHealthCheck });
			await loadEnvironments(projectId);
		} catch (requestError) {
			setActionError(requestError.message);
		} finally {
			setBusyId("");
		}
	};

	const move = async (index, direction) => {
		const target = index + direction;
		if (target < 0 || target >= environments.length) return;
		const next = [...environments];
		[next[index], next[target]] = [next[target], next[index]];
		try {
			setActionError("");
			setReordering(true);
			setEnvironments(next);
			setEnvironments(
				await environmentApi.reorder(
					projectId,
					next.map((environment) => environment._id),
				),
			);
		} catch (requestError) {
			setActionError(requestError.message);
			await loadEnvironments(projectId);
		} finally {
			setReordering(false);
		}
	};

	const projectOptions = (projects || []).map((project) => ({ value: project._id, label: project.name }));
	const busy = reordering || Boolean(busyId);

	return (
		<div className="section-stack">
			<div className="section-toolbar">
				<div className="project-picker">
					<span id="environment-project-label">Project</span>
					{projects === null && (
						<div className="panel-status inline-status" role="status">
							<span className="profile-loader" />
							Loading…
						</div>
					)}
					{projects !== null && projectOptions.length > 0 && (
						<SelectMenu ariaLabel="Choose a project" options={projectOptions} value={projectId} onChange={selectProject} />
					)}
					{projects !== null && projectOptions.length === 0 && !projectError && (
						<span className="picker-empty">No active projects</span>
					)}
				</div>
				<button
					className="primary-button toolbar-action"
					disabled={!canManage || !projectId}
					title={canManage ? undefined : "Only a release manager can create environments."}
					type="button"
					onClick={() => {
						setEditorError("");
						setEditor({ environment: null });
					}}
				>
					<MaterialIcon size={18}>add</MaterialIcon>New environment
				</button>
			</div>

			{!canManage && (
				<p className="role-note">
					<MaterialIcon size={16}>shield_person</MaterialIcon>You are working as a contributor. Environment configuration decides
					where promotion gates apply, so it is limited to release managers.
				</p>
			)}

			{projectError && (
				<div className="panel-error" role="alert">
					<div>
						<strong>Projects couldn’t be loaded</strong>
						<span>{projectError}</span>
					</div>
					<button type="button" onClick={loadProjects}>
						Try again
					</button>
				</div>
			)}

			{actionError && (
				<div className="panel-error" role="alert">
					<div>
						<strong>That didn’t work</strong>
						<span>{actionError}</span>
					</div>
					<button type="button" onClick={() => setActionError("")}>
						Dismiss
					</button>
				</div>
			)}

			{projectId && environments === null && (
				<div className="panel panel-status" role="status">
					<span className="profile-loader" />
					Loading environments…
				</div>
			)}

			{environments !== null && error && (
				<div className="panel-error" role="alert">
					<div>
						<strong>Environments couldn’t be loaded</strong>
						<span>{error}</span>
					</div>
					<button type="button" onClick={() => loadEnvironments(projectId)}>
						Try again
					</button>
				</div>
			)}

			{environments !== null && !error && environments.length === 0 && (
				<div className="pending-section">
					<span className="pending-section-icon">
						<MaterialIcon size={28}>terminal</MaterialIcon>
					</span>
					<h3>{projectId ? "No environments yet" : "Select a project"}</h3>
					<p>
						{projectId
							? "Add development, staging, and production so builds have somewhere to be promoted through."
							: "Create an active project first, then give it environments."}
					</p>
				</div>
			)}

			{environments !== null && !error && environments.length > 0 && (
				<ol className="environment-list">
					{environments.map((environment, index) => (
						<li className="environment-card" key={environment._id}>
							<span className="environment-rank" aria-hidden="true">
								{environment.rank}
							</span>
							<div className="environment-body">
								<div className="environment-head">
									<h3>{environment.name}</h3>
									{index === 0 && <span className="stage-pill">First stage</span>}
									{index === environments.length - 1 && environments.length > 1 && (
										<span className="stage-pill">Final stage</span>
									)}
								</div>
								<p className="environment-meta">
									<span className="sr-only">Promotion rank {environment.rank}. </span>
									{index === 0 ? "Entry point for new builds" : `Promoted from ${environments[index - 1].name}`}
									{environment.currentReleaseId ? " · Release deployed" : " · No release deployed"}
								</p>
								<div className="environment-flags">
									<button
										aria-pressed={environment.requiresHealthCheck}
										className={environment.requiresHealthCheck ? "flag-toggle flag-toggle-on" : "flag-toggle"}
										disabled={!canManage || busyId === environment._id}
										title={canManage ? undefined : "Only a release manager can change the health-check gate."}
										type="button"
										onClick={() => toggleHealthCheck(environment)}
									>
										<MaterialIcon size={15}>
											{environment.requiresHealthCheck ? "check_circle" : "error_outline"}
										</MaterialIcon>
										{environment.requiresHealthCheck ? "Health check required" : "No health check"}
									</button>
									<span className={environment.lockedByDeploymentId ? "lock-chip lock-chip-held" : "lock-chip"}>
										<MaterialIcon size={15}>{environment.lockedByDeploymentId ? "lock" : "lock_open"}</MaterialIcon>
										{environment.lockedByDeploymentId ? `Locked since ${formatDate(environment.lockedAt)}` : "Unlocked"}
									</span>
								</div>
							</div>
							<div className="environment-actions">
								<button
									aria-label={`Edit ${environment.name}`}
									className="icon-button"
									disabled={!canManage || busy}
									title={canManage ? undefined : "Only a release manager can change environment configuration."}
									type="button"
									onClick={() => {
										setEditorError("");
										setEditor({ environment });
									}}
								>
									<MaterialIcon size={18}>edit</MaterialIcon>
								</button>
								<button
									aria-label={`Move ${environment.name} earlier in the promotion order`}
									className="icon-button"
									disabled={!canManage || busy || index === 0}
									title={canManage ? undefined : "Only a release manager can reorder environments."}
									type="button"
									onClick={() => move(index, -1)}
								>
									<MaterialIcon size={18}>arrow_upward</MaterialIcon>
								</button>
								<button
									aria-label={`Move ${environment.name} later in the promotion order`}
									className="icon-button"
									disabled={!canManage || busy || index === environments.length - 1}
									title={canManage ? undefined : "Only a release manager can reorder environments."}
									type="button"
									onClick={() => move(index, 1)}
								>
									<MaterialIcon size={18}>arrow_downward</MaterialIcon>
								</button>
							</div>
						</li>
					))}
				</ol>
			)}

			{editor && (
				<EnvironmentEditor
					busy={saving}
					environment={editor.environment}
					error={editorError}
					onCancel={() => setEditor(null)}
					onSave={save}
				/>
			)}
		</div>
	);
}
