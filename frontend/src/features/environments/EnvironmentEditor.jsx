import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";

export function EnvironmentEditor({ busy = false, environment = null, error = "", onCancel, onSave }) {
    const editing = Boolean(environment);
    const titleId = `environment-editor-${useId().replace(/:/g, "")}`;
    const [name, setName] = useState(environment?.name || "");
    const [requiresHealthCheck, setRequiresHealthCheck] = useState(environment ? environment.requiresHealthCheck : true);
    const [validation, setValidation] = useState("");

    const submit = (event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return setValidation("Give the environment a name.");
        setValidation("");
        return onSave({ name: trimmed, requiresHealthCheck });
    };

    return createPortal(<Modal className="project-editor-modal" labelledBy={titleId} onClose={() => { if (!busy) onCancel(); }}>
        <form className="project-editor" onSubmit={submit}>
            <header className="modal-header">
                <h2 id={titleId}>{editing ? `Edit ${environment.name}` : "New environment"}</h2>
                <button aria-label="Close" className="icon-button" disabled={busy} type="button" onClick={onCancel}><MaterialIcon size={20}>close</MaterialIcon></button>
            </header>
            <div className="project-editor-body">
                <label className="field">
                    <span>Name</span>
                    <input data-autofocus disabled={busy} maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} />
                    {!editing && <small>New environments are added at the end of the promotion order. Reorder them from the list.</small>}
                </label>
                <label className="checkbox-field">
                    <input checked={requiresHealthCheck} disabled={busy} type="checkbox" onChange={(event) => setRequiresHealthCheck(event.target.checked)} />
                    <span>
                        <strong>Require a passing health check</strong>
                        <small>A build cannot be promoted into this environment until its health checks pass.</small>
                    </span>
                </label>
                {(validation || error) && <p className="field-error" role="alert">{validation || error}</p>}
            </div>
            <footer className="project-editor-footer">
                <button disabled={busy} type="button" onClick={onCancel}>Cancel</button>
                <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : editing ? "Save changes" : "Create environment"}</button>
            </footer>
        </form>
    </Modal>, document.body);
}
