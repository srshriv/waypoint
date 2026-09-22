import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { Modal } from "../../shared/components/Modal.jsx";

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function VariableEditor({ busy = false, environmentName, error = "", onCancel, onSave, variable = null }) {
	const editing = Boolean(variable);
	const titleId = `variable-editor-${useId().replace(/:/g, "")}`;
	const [key, setKey] = useState(variable?.key || "");
	// An existing secret's value is not sent to the browser, so editing starts empty and a
	// blank value means "leave it as it is".
	const [value, setValue] = useState(editing && !variable.isSecret ? variable.value || "" : "");
	const [isSecret, setIsSecret] = useState(variable ? variable.isSecret : false);
	const [validation, setValidation] = useState("");

	const submit = (event) => {
		event.preventDefault();
		const trimmedKey = key.trim().toUpperCase();
		if (!KEY_PATTERN.test(trimmedKey))
			return setValidation("Keys are uppercase letters, digits and underscores, starting with a letter.");
		if (!editing && !value) return setValidation("Give the variable a value.");
		setValidation("");
		const patch = { key: trimmedKey, isSecret };
		if (value) patch.value = value;
		return onSave(editing ? patch : { key: trimmedKey, value, isSecret });
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
					<h2 id={titleId}>{editing ? `Edit ${variable.key}` : "New variable"}</h2>
					<button aria-label="Close" className="icon-button" disabled={busy} type="button" onClick={onCancel}>
						<MaterialIcon size={20}>close</MaterialIcon>
					</button>
				</header>
				<div className="project-editor-body">
					<p className="dialog-lead">
						Set on {environmentName}. Each environment holds its own values, so promoting a release does not carry configuration
						with it.
					</p>
					<label className="field">
						<span>Key</span>
						<input
							data-autofocus
							disabled={busy}
							maxLength={100}
							placeholder="DATABASE_URL"
							required
							value={key}
							onChange={(event) => setKey(event.target.value.toUpperCase())}
						/>
					</label>
					<label className="field">
						<span>Value</span>
						<textarea
							disabled={busy}
							maxLength={4000}
							placeholder={editing && variable.isSecret ? "Leave blank to keep the current secret" : ""}
							required={!editing}
							rows={3}
							value={value}
							onChange={(event) => setValue(event.target.value)}
						/>
						{editing && (
							<small>
								{variable.isSecret
									? "The current secret is never sent to the browser. Leave this blank to keep it."
									: "Leave blank to keep the current value."}
							</small>
						)}
					</label>
					<label className="checkbox-field">
						<input checked={isSecret} disabled={busy} type="checkbox" onChange={(event) => setIsSecret(event.target.checked)} />
						<span>
							<strong>Treat this as a secret</strong>
							<small>
								The value is masked everywhere it is listed. Revealing it is a separate, release-manager-only request.
							</small>
						</span>
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
						{busy ? "Saving…" : editing ? "Save changes" : "Add variable"}
					</button>
				</footer>
			</form>
		</Modal>,
		document.body,
	);
}
