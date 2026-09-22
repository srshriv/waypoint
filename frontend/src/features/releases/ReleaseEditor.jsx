import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";

const CHANGE_TYPES = ["added", "modified", "removed"];
const blankChange = () => ({ path: "", changeType: "modified" });

export function ReleaseEditor({ busy = false, defaultAuthor = "", error = "", onCancel, onSave }) {
    const titleId = `release-editor-${useId().replace(/:/g, "")}`;
    const [version, setVersion] = useState("");
    const [commitSha, setCommitSha] = useState("");
    const [commitMessage, setCommitMessage] = useState("");
    const [author, setAuthor] = useState(defaultAuthor);
    const [changes, setChanges] = useState([blankChange()]);
    const [validation, setValidation] = useState("");

    const updateChange = (index, patch) => setChanges((current) => current.map((change, position) => (position === index ? { ...change, ...patch } : change)));

    const submit = (event) => {
        event.preventDefault();
        const cleaned = changes.map((change) => ({ path: change.path.trim(), changeType: change.changeType })).filter((change) => change.path);
        if (!version.trim()) return setValidation("Give the release a version.");
        if (!/^[0-9a-f]{7,40}$/i.test(commitSha.trim())) return setValidation("The commit sha must be 7 to 40 hex characters.");
        if (!commitMessage.trim()) return setValidation("Add the commit message.");
        if (!author.trim()) return setValidation("Name the author.");
        if (cleaned.length === 0) return setValidation("List at least one changed file.");
        const paths = cleaned.map((change) => change.path);
        if (new Set(paths).size !== paths.length) return setValidation("List each changed path once.");
        setValidation("");
        return onSave({ version: version.trim(), commitSha: commitSha.trim().toLowerCase(), commitMessage: commitMessage.trim(), author: author.trim(), changes: cleaned });
    };

    return createPortal(<Modal className="project-editor-modal" labelledBy={titleId} onClose={() => { if (!busy) onCancel(); }}>
        <form className="project-editor" onSubmit={submit}>
            <header className="modal-header">
                <h2 id={titleId}>Cut a release</h2>
                <button aria-label="Close" className="icon-button" disabled={busy} type="button" onClick={onCancel}><MaterialIcon size={20}>close</MaterialIcon></button>
            </header>
            <div className="project-editor-body">
                <p className="dialog-lead">A release is an immutable record of a build. Once cut it is never edited, so every environment that runs it runs the same thing.</p>
                <div className="field-row">
                    <label className="field">
                        <span>Version</span>
                        <input data-autofocus disabled={busy} maxLength={40} placeholder="2.1.0" required value={version} onChange={(event) => setVersion(event.target.value)} />
                    </label>
                    <label className="field">
                        <span>Commit sha</span>
                        <input disabled={busy} maxLength={40} placeholder="9f2c1ab" required value={commitSha} onChange={(event) => setCommitSha(event.target.value)} />
                    </label>
                </div>
                <label className="field">
                    <span>Commit message</span>
                    <input disabled={busy} maxLength={300} required value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} />
                </label>
                <label className="field">
                    <span>Author</span>
                    <input disabled={busy} maxLength={120} required value={author} onChange={(event) => setAuthor(event.target.value)} />
                </label>
                <div className="field">
                    <span>Changed files</span>
                    <ul className="change-rows">
                        {changes.map((change, index) => <li key={index}>
                            <input
                                aria-label={`Path for change ${index + 1}`}
                                disabled={busy}
                                maxLength={300}
                                placeholder="src/orders/order.service.js"
                                value={change.path}
                                onChange={(event) => updateChange(index, { path: event.target.value })}
                            />
                            <select aria-label={`Change type for change ${index + 1}`} disabled={busy} value={change.changeType} onChange={(event) => updateChange(index, { changeType: event.target.value })}>
                                {CHANGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                            <button
                                aria-label={`Remove change ${index + 1}`}
                                className="icon-button"
                                disabled={busy || changes.length === 1}
                                type="button"
                                onClick={() => setChanges((current) => current.filter((_, position) => position !== index))}
                            ><MaterialIcon size={18}>close</MaterialIcon></button>
                        </li>)}
                    </ul>
                    <button className="link-button" disabled={busy} type="button" onClick={() => setChanges((current) => [...current, blankChange()])}>
                        <MaterialIcon size={16}>add</MaterialIcon>Add another file
                    </button>
                </div>
                {(validation || error) && <p className="field-error" role="alert">{validation || error}</p>}
            </div>
            <footer className="project-editor-footer">
                <button disabled={busy} type="button" onClick={onCancel}>Cancel</button>
                <button className="primary-button" disabled={busy} type="submit">{busy ? "Cutting…" : "Cut release"}</button>
            </footer>
        </form>
    </Modal>, document.body);
}
