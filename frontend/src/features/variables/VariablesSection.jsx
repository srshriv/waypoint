import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { SelectMenu } from "../../shared/components/SelectMenu.jsx";
import { environmentApi } from "../environments/environment.api.js";
import { projectApi } from "../projects/project.api.js";
import { VariableEditor } from "./VariableEditor.jsx";
import { variableApi } from "./variable.api.js";

const PROJECT_STORAGE_KEY = "waypoint-variable-project";

export function VariablesSection({ activeProfile }) {
    const canManage = activeProfile.role === "releaseManager";
    const [projects, setProjects] = useState(null);
    const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_STORAGE_KEY) || "");
    const [environments, setEnvironments] = useState(null);
    const [environmentId, setEnvironmentId] = useState("");
    const [variables, setVariables] = useState(null);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [editor, setEditor] = useState(null);
    const [editorError, setEditorError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    // Revealed values live only in this component's state and are dropped on any navigation.
    const [revealed, setRevealed] = useState({});
    const [revealingId, setRevealingId] = useState("");

    const loadProjects = useCallback(async () => {
        try {
            setError("");
            const rows = await projectApi.list("active");
            setProjects(rows);
            setProjectId((current) => (rows.some((row) => row._id === current) ? current : rows[0]?._id || ""));
        } catch (requestError) { setError(requestError.message); setProjects([]); }
    }, []);
    useEffect(() => { loadProjects(); }, [loadProjects]);

    useEffect(() => {
        if (!projectId) { setEnvironments([]); return undefined; }
        let active = true;
        (async () => {
            try {
                const rows = await environmentApi.list(projectId);
                if (!active) return;
                setEnvironments(rows);
                setEnvironmentId((current) => (rows.some((row) => row._id === current) ? current : rows[0]?._id || ""));
            } catch (requestError) { if (active) { setError(requestError.message); setEnvironments([]); } }
        })();
        return () => { active = false; };
    }, [projectId]);

    const loadVariables = useCallback(async (project, environment) => {
        if (!project || !environment) { setVariables([]); return; }
        try {
            setError(""); setVariables(null); setRevealed({});
            setVariables(await variableApi.list(project, environment));
        } catch (requestError) { setError(requestError.message); setVariables([]); }
    }, []);
    useEffect(() => { loadVariables(projectId, environmentId); }, [loadVariables, projectId, environmentId]);

    const save = async (input) => {
        try {
            setSaving(true); setEditorError("");
            if (editor.variable) await variableApi.update(projectId, environmentId, editor.variable._id, input);
            else await variableApi.create(projectId, environmentId, input);
            setEditor(null);
            await loadVariables(projectId, environmentId);
        } catch (requestError) { setEditorError(requestError.message); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        try {
            setDeleteBusy(true); setActionError("");
            await variableApi.remove(projectId, environmentId, deleting._id);
            setDeleting(null);
            await loadVariables(projectId, environmentId);
        } catch (requestError) { setActionError(requestError.message); }
        finally { setDeleteBusy(false); }
    };

    const reveal = async (variable) => {
        if (revealed[variable._id]) {
            setRevealed((current) => { const next = { ...current }; delete next[variable._id]; return next; });
            return;
        }
        try {
            setActionError(""); setRevealingId(variable._id);
            const result = await variableApi.reveal(projectId, environmentId, variable._id);
            setRevealed((current) => ({ ...current, [variable._id]: result.value }));
        } catch (requestError) { setActionError(requestError.message); }
        finally { setRevealingId(""); }
    };

    const projectOptions = (projects || []).map((project) => ({ value: project._id, label: project.name }));
    const environmentOptions = (environments || []).map((row) => ({ value: row._id, label: `${row.name} · rank ${row.rank}` }));
    const environment = (environments || []).find((row) => row._id === environmentId);
    const secretCount = (variables || []).filter((variable) => variable.isSecret).length;

    return <div className="section-stack">
        <div className="section-toolbar">
            <div className="picker-group">
                <div className="project-picker">
                    <span>Project</span>
                    {projects === null ? <div className="panel-status inline-status" role="status"><span className="profile-loader" /></div>
                        : projectOptions.length > 0 ? <SelectMenu ariaLabel="Choose a project" options={projectOptions} value={projectId} onChange={(id) => { setProjectId(id); localStorage.setItem(PROJECT_STORAGE_KEY, id); }} />
                            : <span className="picker-empty">No active projects</span>}
                </div>
                <div className="project-picker">
                    <span>Environment</span>
                    {environments === null ? <div className="panel-status inline-status" role="status"><span className="profile-loader" /></div>
                        : environmentOptions.length > 0 ? <SelectMenu ariaLabel="Choose an environment" options={environmentOptions} value={environmentId} onChange={setEnvironmentId} />
                            : <span className="picker-empty">No environments</span>}
                </div>
            </div>
            <button
                className="primary-button toolbar-action"
                disabled={!canManage || !environmentId}
                title={canManage ? undefined : "Only a release manager can add variables."}
                type="button"
                onClick={() => { setEditorError(""); setEditor({ variable: null }); }}
            >
                <MaterialIcon size={18}>add</MaterialIcon>New variable
            </button>
        </div>

        {!canManage && <p className="role-note">
            <MaterialIcon size={16}>shield_person</MaterialIcon>
            You are working as a contributor. Secret values stay masked and only a release manager can add, edit or reveal them.
        </p>}

        {error && <div className="panel-error" role="alert">
            <div><strong>Variables couldn’t be loaded</strong><span>{error}</span></div>
            <button type="button" onClick={() => loadVariables(projectId, environmentId)}>Try again</button>
        </div>}
        {actionError && <div className="panel-error" role="alert">
            <div><strong>That didn’t work</strong><span>{actionError}</span></div>
            <button type="button" onClick={() => setActionError("")}>Dismiss</button>
        </div>}

        {variables === null && <div className="panel panel-status" role="status"><span className="profile-loader" />Loading variables…</div>}

        {variables !== null && !error && variables.length === 0 && <div className="pending-section">
            <span className="pending-section-icon"><MaterialIcon size={28}>key</MaterialIcon></span>
            <h3>No variables on this environment</h3>
            <p>Environment variables are held per environment, so each stage can point at its own database, keys and limits.</p>
        </div>}

        {variables !== null && variables.length > 0 && <section className="panel" aria-labelledby="variables-title">
            <header className="panel-header">
                <h3 id="variables-title">{environment?.name} · {variables.length} variables</h3>
                <p>{secretCount} marked secret. Secret values are masked by the API and never sent to the browser until explicitly revealed.</p>
            </header>
            <ul className="variable-list">
                {variables.map((variable) => <li className="variable-row" key={variable._id}>
                    <code className="variable-key">{variable.key}</code>
                    <span className={variable.isSecret && !revealed[variable._id] ? "variable-value variable-value-masked" : "variable-value"}>
                        {revealed[variable._id] ?? variable.preview}
                    </span>
                    {variable.isSecret && <span className="secret-tag"><MaterialIcon size={13}>lock</MaterialIcon>secret</span>}
                    <span className="variable-actions">
                        {variable.isSecret && <button
                            className="ghost-button"
                            disabled={!canManage || revealingId === variable._id}
                            title={canManage ? undefined : "Only a release manager can reveal a secret."}
                            type="button"
                            onClick={() => reveal(variable)}
                        >{revealingId === variable._id ? "Revealing…" : revealed[variable._id] ? "Hide" : "Reveal"}</button>}
                        <button
                            aria-label={`Edit ${variable.key}`}
                            className="icon-button"
                            disabled={!canManage}
                            title={canManage ? undefined : "Only a release manager can edit variables."}
                            type="button"
                            onClick={() => { setEditorError(""); setEditor({ variable }); }}
                        ><MaterialIcon size={17}>edit</MaterialIcon></button>
                        <button
                            aria-label={`Delete ${variable.key}`}
                            className="icon-button"
                            disabled={!canManage}
                            title={canManage ? undefined : "Only a release manager can delete variables."}
                            type="button"
                            onClick={() => { setActionError(""); setDeleting(variable); }}
                        ><MaterialIcon size={17}>close</MaterialIcon></button>
                    </span>
                </li>)}
            </ul>
        </section>}

        {editor && <VariableEditor
            busy={saving}
            environmentName={environment?.name || "this environment"}
            error={editorError}
            variable={editor.variable}
            onCancel={() => setEditor(null)}
            onSave={save}
        />}
        {deleting && <ConfirmationDialog
            busy={deleteBusy}
            confirmLabel="Delete"
            message={`${deleting.key} will be removed from ${environment?.name}. Deployments that expect it may fail until it is replaced.`}
            title="Delete this variable?"
            onCancel={() => setDeleting(null)}
            onConfirm={confirmDelete}
        />}
    </div>;
}
