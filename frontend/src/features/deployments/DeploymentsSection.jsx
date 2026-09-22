import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { SelectMenu } from "../../shared/components/SelectMenu.jsx";
import { environmentApi } from "../environments/environment.api.js";
import { projectApi } from "../projects/project.api.js";
import { releaseApi } from "../releases/release.api.js";
import { DeploymentLogView } from "./DeploymentLogView.jsx";
import { RollbackDialog } from "./RollbackDialog.jsx";
import { deploymentApi } from "./deployment.api.js";
import { KIND_LABELS, STATUS_LABELS, STATUS_TONE, STEP_ICON, elapsedLabel, isRunning } from "./deployment-status.js";

/** Turns an API error into something the operator can act on. */
function describeError(error) {
	if (error.code === "ENVIRONMENT_LOCKED" && error.details) {
		const holder = error.details.lockedByDeploymentId
			? `deployment ${String(error.details.lockedByDeploymentId).slice(-8)}`
			: "another deployment";
		const until = error.details.leaseExpiresAt ? new Date(error.details.leaseExpiresAt) : null;
		const when = until ? `, whose lease runs until ${until.toLocaleTimeString()}` : "";
		return `${error.details.environmentName || "That environment"} is locked by ${holder}${when}. Try again once it finishes.`;
	}
	return error.message;
}

const PROJECT_STORAGE_KEY = "waypoint-deployment-project";
const POLL_MS = 600;

const newRequestKey = () => (crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

export function DeploymentsSection({ activeProfile }) {
	const [projects, setProjects] = useState(null);
	const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_STORAGE_KEY) || "");
	const [environments, setEnvironments] = useState(null);
	const [environmentId, setEnvironmentId] = useState("");
	const [releases, setReleases] = useState(null);
	const [releaseId, setReleaseId] = useState("");
	const [deployments, setDeployments] = useState(null);
	const [selectedId, setSelectedId] = useState("");
	const [selected, setSelected] = useState(null);
	const [lines, setLines] = useState([]);
	const [error, setError] = useState("");
	const [triggering, setTriggering] = useState(false);
	const [notice, setNotice] = useState("");
	const [rollbackOpen, setRollbackOpen] = useState(false);
	const [promoteOpen, setPromoteOpen] = useState(false);
	// Loaded up front so the Roll back button knows whether there is anywhere to roll back to,
	// rather than opening a dialog only to report that there is not.
	const [rollbackTargets, setRollbackTargets] = useState(null);

	// Held across retries so a failed submit or an impatient second click reuses the same key
	// and the API returns the deployment already queued instead of starting a second one.
	const requestKeyReference = useRef(newRequestKey());
	const cursorReference = useRef(0);

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

	useEffect(() => {
		if (!projectId) {
			setEnvironments([]);
			setReleases([]);
			return undefined;
		}
		let active = true;
		(async () => {
			try {
				const [environmentRows, releaseRows] = await Promise.all([environmentApi.list(projectId), releaseApi.list(projectId)]);
				if (!active) return;
				setEnvironments(environmentRows);
				setEnvironmentId((current) =>
					environmentRows.some((row) => row._id === current) ? current : environmentRows[0]?._id || "",
				);
				setReleases(releaseRows);
				setReleaseId((current) => (releaseRows.some((row) => row._id === current) ? current : releaseRows[0]?._id || ""));
			} catch (requestError) {
				if (active) {
					setError(requestError.message);
					setEnvironments([]);
					setReleases([]);
				}
			}
		})();
		return () => {
			active = false;
		};
	}, [projectId]);

	const loadDeployments = useCallback(async (id) => {
		if (!id) {
			setDeployments([]);
			return [];
		}
		const rows = await deploymentApi.list(id);
		setDeployments(rows);
		return rows;
	}, []);

	const loadRollbackTargets = useCallback(async (project, environment) => {
		if (!project || !environment) {
			setRollbackTargets([]);
			return;
		}
		try {
			setRollbackTargets(await deploymentApi.rollbackTargets(project, environment));
		} catch {
			setRollbackTargets([]);
		}
	}, []);
	useEffect(() => {
		setRollbackTargets(null);
		loadRollbackTargets(projectId, environmentId);
	}, [loadRollbackTargets, projectId, environmentId]);
	useEffect(() => {
		if (!projectId) return;
		setDeployments(null);
		setSelectedId("");
		setSelected(null);
		setLines([]);
		cursorReference.current = 0;
		loadDeployments(projectId)
			.then((rows) => setSelectedId(rows[0]?._id || ""))
			.catch((e) => setError(e.message));
	}, [loadDeployments, projectId]);

	// Poll the selected deployment and pull only log lines past the cursor.
	useEffect(() => {
		if (!projectId || !selectedId) return undefined;
		let active = true;
		let timer = null;
		cursorReference.current = 0;
		setLines([]);
		const poll = async () => {
			try {
				const deployment = await deploymentApi.get(projectId, selectedId);
				if (!active) return;
				setSelected(deployment);
				const batch = await deploymentApi.logs(projectId, selectedId, cursorReference.current);
				if (!active) return;
				if (batch.lines.length) {
					cursorReference.current = batch.cursor;
					setLines((current) => [...current, ...batch.lines]);
				}
				if (isRunning(deployment)) {
					timer = setTimeout(poll, POLL_MS);
				} else {
					// Settled: what is live on the environment may have changed, so the set of
					// rollback targets has too.
					loadDeployments(projectId).catch(() => {});
					loadRollbackTargets(projectId, environmentId);
				}
			} catch (requestError) {
				if (active) setError(requestError.message);
			}
		};
		poll();
		return () => {
			active = false;
			if (timer) clearTimeout(timer);
		};
	}, [environmentId, loadDeployments, loadRollbackTargets, projectId, selectedId]);

	const environment = (environments || []).find((row) => row._id === environmentId);
	const isManager = activeProfile.role === "releaseManager";
	const canDeploy = Boolean(environment) && Boolean(releaseId) && (environment.rank === 0 || isManager);
	// A promotion moves exactly one rank up, so the only valid target is the next rank.
	const promotionTarget = environment ? (environments || []).find((row) => row.rank === environment.rank + 1) : null;
	const canPromote = isManager && Boolean(promotionTarget) && Boolean(environment?.currentReleaseId);
	// Anything already live is not a rollback target, so an environment on its first release
	// has nowhere to go back to.
	const selectableRollbackTargets = (rollbackTargets || []).filter((target) => !target.isCurrent);
	const canRollback = isManager && Boolean(environment) && selectableRollbackTargets.length > 0;

	const run = async (label, action) => {
		try {
			setTriggering(true);
			setError("");
			setNotice("");
			const result = await action(requestKeyReference.current);
			requestKeyReference.current = newRequestKey();
			if (result.reused) setNotice(`That ${label} was already queued, so Waypoint reopened it instead of starting a second one.`);
			await loadDeployments(projectId);
			setSelectedId(result.deployment._id);
			return true;
		} catch (requestError) {
			setError(describeError(requestError));
			return false;
		} finally {
			setTriggering(false);
		}
	};

	const deploy = () => run("deployment", (key) => deploymentApi.trigger(projectId, environmentId, releaseId, key));
	const promote = async () => {
		const ok = await run("promotion", (key) => deploymentApi.promote(projectId, environmentId, promotionTarget._id, key));
		if (ok) setPromoteOpen(false);
	};
	const rollback = async (targetDeploymentId) => {
		const ok = await run("rollback", (key) => deploymentApi.rollback(projectId, environmentId, targetDeploymentId, key));
		if (ok) setRollbackOpen(false);
	};

	const projectOptions = (projects || []).map((project) => ({ value: project._id, label: project.name }));
	const environmentOptions = (environments || []).map((row) => ({ value: row._id, label: `${row.name} · rank ${row.rank}` }));
	const releaseOptions = (releases || []).map((row) => ({ value: row._id, label: `${row.version} · ${row.commitSha.slice(0, 7)}` }));
	const releaseById = new Map((releases || []).map((row) => [String(row._id), row]));
	const versionOf = (id) => releaseById.get(String(id))?.version || String(id || "").slice(-8);

	return (
		<div className="section-stack">
			<div className="deploy-bar">
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
				<div className="project-picker">
					<span>Environment</span>
					{environments === null ? (
						<div className="panel-status inline-status" role="status">
							<span className="profile-loader" />
						</div>
					) : environmentOptions.length > 0 ? (
						<SelectMenu
							ariaLabel="Choose an environment"
							options={environmentOptions}
							value={environmentId}
							onChange={setEnvironmentId}
						/>
					) : (
						<span className="picker-empty">No environments</span>
					)}
				</div>
				<div className="project-picker">
					<span>Release</span>
					{releases === null ? (
						<div className="panel-status inline-status" role="status">
							<span className="profile-loader" />
						</div>
					) : releaseOptions.length > 0 ? (
						<SelectMenu ariaLabel="Choose a release" options={releaseOptions} value={releaseId} onChange={setReleaseId} />
					) : (
						<span className="picker-empty">No releases yet</span>
					)}
				</div>
				<div className="deploy-actions">
					<button
						className="secondary-button"
						disabled={!canRollback || triggering}
						title={
							!isManager
								? "Only a release manager can roll back."
								: rollbackTargets === null
									? "Checking this environment's history…"
									: !canRollback
										? `${environment?.name || "This environment"} has no earlier release to return to.`
										: undefined
						}
						type="button"
						onClick={() => {
							setError("");
							setRollbackOpen(true);
						}}
					>
						<MaterialIcon size={18}>undo</MaterialIcon>Roll back
					</button>
					<button
						className="secondary-button"
						disabled={!canPromote || triggering}
						title={
							!isManager
								? "Only a release manager can promote."
								: !promotionTarget
									? "This is the final stage of the promotion order."
									: !environment?.currentReleaseId
										? "Nothing is live here to promote."
										: undefined
						}
						type="button"
						onClick={() => {
							setError("");
							setPromoteOpen(true);
						}}
					>
						<MaterialIcon size={18}>arrow_upward</MaterialIcon>
						{promotionTarget ? `Promote to ${promotionTarget.name}` : "Promote"}
					</button>
					<button
						className="primary-button toolbar-action"
						disabled={!canDeploy || triggering || !environmentId}
						title={
							!releaseId
								? "Cut a release before deploying."
								: canDeploy
									? undefined
									: "Only a release manager can deploy beyond the first stage."
						}
						type="button"
						onClick={deploy}
					>
						<MaterialIcon size={18}>rocket_launch</MaterialIcon>
						{triggering ? "Queueing…" : "Deploy"}
					</button>
				</div>
			</div>

			{environment && !canDeploy && (
				<p className="role-note">
					<MaterialIcon size={16}>shield_person</MaterialIcon>
					{environment.name} sits at promotion rank {environment.rank}. Contributors can deploy to the first stage only.
				</p>
			)}
			{notice && (
				<p className="role-note">
					<MaterialIcon size={16}>check_circle</MaterialIcon>
					{notice}
				</p>
			)}
			{error && (
				<div className="panel-error" role="alert">
					<div>
						<strong>That didn’t work</strong>
						<span>{error}</span>
					</div>
					<button type="button" onClick={() => setError("")}>
						Dismiss
					</button>
				</div>
			)}

			{deployments === null && (
				<div className="panel panel-status" role="status">
					<span className="profile-loader" />
					Loading deployments…
				</div>
			)}

			{deployments !== null && deployments.length === 0 && (
				<div className="pending-section">
					<span className="pending-section-icon">
						<MaterialIcon size={28}>rocket_launch</MaterialIcon>
					</span>
					<h3>No deployments yet</h3>
					<p>Pick an environment and press Deploy. The background worker will pick the job up and stream its build log here.</p>
				</div>
			)}

			{deployments !== null && deployments.length > 0 && (
				<div className="deploy-layout">
					<ul className="deploy-list">
						{deployments.map((deployment) => (
							<li key={deployment._id}>
								<button
									aria-current={deployment._id === selectedId ? "true" : undefined}
									className="deploy-list-item"
									type="button"
									onClick={() => setSelectedId(deployment._id)}
								>
									<span className={`status-dot status-dot-${STATUS_TONE[deployment.status]}`} aria-hidden="true" />
									<span className="deploy-list-body">
										<strong>
											{(environments || []).find((e) => e._id === deployment.environmentId)?.name || "Environment"}
										</strong>
										<small>
											{KIND_LABELS[deployment.kind]} · {versionOf(deployment.releaseId)} ·{" "}
											{STATUS_LABELS[deployment.status]}
										</small>
									</span>
								</button>
							</li>
						))}
					</ul>

					<div className="deploy-detail">
						{selected && (
							<>
								<header className="deploy-detail-head">
									<span className={`status-pill status-pill-${STATUS_TONE[selected.status]}`}>
										{STATUS_LABELS[selected.status]}
									</span>
									<h3>
										{KIND_LABELS[selected.kind]} · {versionOf(selected.releaseId)} →{" "}
										{(environments || []).find((e) => e._id === selected.environmentId)?.name || "Environment"}
									</h3>
									<span className="deploy-elapsed">
										{elapsedLabel(selected)}
										{isRunning(selected) ? " elapsed" : ""}
									</span>
								</header>
								<ol className="step-list">
									{selected.steps.map((step) => (
										<li className={`step-row step-row-${step.status}`} key={step.key}>
											<MaterialIcon size={18}>{STEP_ICON[step.status]}</MaterialIcon>
											<span className="step-name">{step.name}</span>
											{step.attempts > 1 && <span className="step-attempts">{step.attempts} attempts</span>}
											{step.detail && <span className="step-detail">{step.detail}</span>}
										</li>
									))}
								</ol>
								<DeploymentLogView lines={lines} live={isRunning(selected)} />
							</>
						)}
					</div>
				</div>
			)}

			{promoteOpen && environment && promotionTarget && (
				<ConfirmationDialog
					busy={triggering}
					confirmLabel={`Promote to ${promotionTarget.name}`}
					error={error}
					message={`Release ${versionOf(environment.currentReleaseId)} currently live on ${environment.name} will be deployed to ${promotionTarget.name} (rank ${promotionTarget.rank}).${promotionTarget.requiresHealthCheck ? " That environment requires a passing health check." : ""}`}
					title={`Promote to ${promotionTarget.name}?`}
					onCancel={() => setPromoteOpen(false)}
					onConfirm={promote}
				/>
			)}
			{rollbackOpen && environment && (
				<RollbackDialog
					busy={triggering}
					environment={environment}
					error={error}
					targets={rollbackTargets || []}
					onCancel={() => setRollbackOpen(false)}
					onConfirm={rollback}
				/>
			)}
		</div>
	);
}
