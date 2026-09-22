import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { formatDate } from "../../shared/utils/format.js";
import { ProjectEditor } from "./ProjectEditor.jsx";
import { projectApi } from "./project.api.js";

const FILTERS = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
    { value: "all", label: "All" },
];

const EMPTY_COPY = {
    active: { title: "No active projects yet", body: "Create a project to give its environments, releases, and deployments somewhere to live." },
    archived: { title: "Nothing archived", body: "Archived projects keep their release history and can be restored at any time." },
    all: { title: "No projects yet", body: "Create a project to give its environments, releases, and deployments somewhere to live." },
};

export function ProjectsSection() {
    const [status, setStatus] = useState("active");
    const [projects, setProjects] = useState(null);
    const [error, setError] = useState("");
    const [editor, setEditor] = useState(null);
    const [editorError, setEditorError] = useState("");
    const [saving, setSaving] = useState(false);
    const [archiving, setArchiving] = useState(null);
    const [archiveError, setArchiveError] = useState("");
    const [archiveBusy, setArchiveBusy] = useState(false);
    const [busyId, setBusyId] = useState("");
    const [actionError, setActionError] = useState("");

    const load = useCallback(async (nextStatus) => {
        try { setError(""); setProjects(null); setProjects(await projectApi.list(nextStatus)); }
        catch (requestError) { setError(requestError.message); setProjects([]); }
    }, []);
    useEffect(() => { load(status); }, [load, status]);

    const save = async (input) => {
        try {
            setSaving(true); setEditorError("");
            if (editor.project) await projectApi.update(editor.project._id, input);
            else await projectApi.create(input);
            setEditor(null);
            await load(status);
        } catch (requestError) { setEditorError(requestError.message); }
        finally { setSaving(false); }
    };
    const confirmArchive = async () => {
        try {
            setArchiveBusy(true); setArchiveError("");
            await projectApi.archive(archiving._id);
            setArchiving(null);
            await load(status);
        } catch (requestError) { setArchiveError(requestError.message); }
        finally { setArchiveBusy(false); }
    };
    const restore = async (project) => {
        try { setActionError(""); setBusyId(project._id); await projectApi.restore(project._id); await load(status); }
        catch (requestError) { setActionError(requestError.message); }
        finally { setBusyId(""); }
    };

    const empty = EMPTY_COPY[status];
    return <div className="section-stack">
        <div className="section-toolbar">
            <div className="segmented" role="group" aria-label="Filter projects">
                {FILTERS.map((filter) => <button
                    aria-pressed={status === filter.value}
                    key={filter.value}
                    type="button"
                    onClick={() => setStatus(filter.value)}
                >{filter.label}</button>)}
            </div>
            <button className="primary-button toolbar-action" type="button" onClick={() => { setEditorError(""); setEditor({ project: null }); }}>
                <MaterialIcon size={18}>add</MaterialIcon>New project
            </button>
        </div>

        {actionError && <div className="panel-error" role="alert"><div><strong>That didn’t work</strong><span>{actionError}</span></div><button type="button" onClick={() => setActionError("")}>Dismiss</button></div>}

        {projects === null && <div className="panel panel-status" role="status"><span className="profile-loader" />Loading projects…</div>}

        {projects !== null && error && <div className="panel-error" role="alert">
            <div><strong>Projects couldn’t be loaded</strong><span>{error}</span></div>
            <button type="button" onClick={() => load(status)}>Try again</button>
        </div>}

        {projects !== null && !error && projects.length === 0 && <div className="pending-section">
            <span className="pending-section-icon"><MaterialIcon size={28}>layers</MaterialIcon></span>
            <h3>{empty.title}</h3>
            <p>{empty.body}</p>
        </div>}

        {projects !== null && !error && projects.length > 0 && <ul className="project-list">
            {projects.map((project) => <li className={project.archivedAt ? "project-card project-card-archived" : "project-card"} key={project._id}>
                <div className="project-card-head">
                    <h3>{project.name}</h3>
                    <code className="project-slug">{project.slug}</code>
                    {project.archivedAt && <span className="status-pill status-pill-archived">Archived {formatDate(project.archivedAt)}</span>}
                </div>
                {project.description && <p className="project-card-description">{project.description}</p>}
                <div className="project-card-meta">
                    {project.repositoryUrl && <a href={project.repositoryUrl} rel="noreferrer noopener" target="_blank">{project.repositoryUrl.replace(/^https?:\/\//i, "")}</a>}
                    <span>Created {formatDate(project.createdAt)}</span>
                </div>
                <div className="project-card-actions">
                    {!project.archivedAt && <button type="button" onClick={() => { setEditorError(""); setEditor({ project }); }}>Edit</button>}
                    {!project.archivedAt && <button type="button" onClick={() => { setArchiveError(""); setArchiving(project); }}>Archive</button>}
                    {project.archivedAt && <button disabled={busyId === project._id} type="button" onClick={() => restore(project)}>{busyId === project._id ? "Restoring…" : "Restore"}</button>}
                </div>
            </li>)}
        </ul>}

        {editor && <ProjectEditor
            busy={saving}
            error={editorError}
            project={editor.project}
            onCancel={() => setEditor(null)}
            onSave={save}
        />}
        {archiving && <ConfirmationDialog
            busy={archiveBusy}
            confirmLabel="Archive"
            error={archiveError}
            message={`${archiving.name} will stop accepting deployments. Its release history is kept and you can restore it later.`}
            title="Archive this project?"
            onCancel={() => setArchiving(null)}
            onConfirm={confirmArchive}
        />}
    </div>;
}
