import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";
import { formatDate } from "../../shared/utils/format.js";

/**
 * Targets are loaded by the section rather than here, so the Roll back button and this dialog
 * are driven by the same data and cannot disagree about whether a rollback is possible.
 */
export function RollbackDialog({ busy = false, environment, error = "", onCancel, onConfirm, targets = [] }) {
    const titleId = `rollback-${useId().replace(/:/g, "")}`;
    const selectable = targets.filter((target) => !target.isCurrent);
    const [selectedId, setSelectedId] = useState(() => selectable[0]?._id || "");

    return createPortal(<Modal className="project-editor-modal" labelledBy={titleId} onClose={() => { if (!busy) onCancel(); }}>
        <div className="project-editor">
            <header className="modal-header">
                <h2 id={titleId}>Roll back {environment.name}</h2>
                <button aria-label="Close" className="icon-button" disabled={busy} type="button" onClick={onCancel}><MaterialIcon size={20}>close</MaterialIcon></button>
            </header>
            <div className="project-editor-body">
                <p className="dialog-lead">Pick an earlier deployment that went live on {environment.name}. Rollback is not gated on health checks, so it stays available while a release is misbehaving.</p>
                {selectable.length === 0 && <p className="dialog-empty">There is no earlier release on {environment.name} to return to.</p>}
                {selectable.length > 0 && <ul className="rollback-options">
                    {targets.map((target) => <li key={target._id}>
                        <label className={target.isCurrent ? "rollback-option rollback-option-current" : "rollback-option"}>
                            <input
                                checked={selectedId === target._id}
                                disabled={busy || target.isCurrent}
                                name="rollback-target"
                                type="radio"
                                value={target._id}
                                onChange={() => setSelectedId(target._id)}
                            />
                            <span>
                                <strong>Release {String(target.releaseId).slice(-8)}</strong>
                                <small>
                                    {target.kind} · {formatDate(target.finishedAt || target.queuedAt)}
                                    {target.isCurrent ? " · currently live" : ""}
                                </small>
                            </span>
                        </label>
                    </li>)}
                </ul>}
                {error && <p className="field-error" role="alert">{error}</p>}
            </div>
            <footer className="project-editor-footer">
                <button data-autofocus disabled={busy} type="button" onClick={onCancel}>Cancel</button>
                <button className="primary-button" disabled={busy || !selectedId} type="button" onClick={() => onConfirm(selectedId)}>
                    {busy ? "Queueing…" : "Roll back"}
                </button>
            </footer>
        </div>
    </Modal>, document.body);
}
