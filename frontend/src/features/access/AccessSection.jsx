import { useCallback, useEffect, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { roleLabel } from "../../shared/constants/roles.js";
import { ProfileAvatar } from "../profiles/ProfileAvatar.jsx";
import { profileApi } from "../profiles/profile.api.js";

// Only rules the API enforces today. Each capability adds its own rows as it lands, so this
// table never describes an action the product cannot actually perform.
const PERMISSIONS = [
	{ action: "View your projects and their environments", releaseManager: true, contributor: true },
	{ action: "Create, edit, and archive your own projects", releaseManager: true, contributor: true },
	{ action: "Create an environment and set the promotion order", releaseManager: true, contributor: false },
	{ action: "Rename an environment or change its health-check gate", releaseManager: true, contributor: false },
	{ action: "See which variables an environment sets, with secrets masked", releaseManager: true, contributor: true },
	{ action: "Add, edit or delete an environment variable", releaseManager: true, contributor: false },
	{ action: "Reveal a secret value in the clear", releaseManager: true, contributor: false },
	{ action: "Cut a release, recording an immutable build", releaseManager: true, contributor: true },
	{ action: "Deploy to the first stage of the promotion order", releaseManager: true, contributor: true },
	{ action: "Deploy to any later stage, such as staging or production", releaseManager: true, contributor: false },
	{ action: "Promote the live release one rank up the promotion order", releaseManager: true, contributor: false },
	{ action: "Roll an environment back to an earlier successful release", releaseManager: true, contributor: false },
];

export function AccessSection({ activeProfile }) {
	const [members, setMembers] = useState(null);
	const [error, setError] = useState("");
	const load = useCallback(async () => {
		try {
			setError("");
			setMembers(null);
			setMembers(await profileApi.list());
		} catch (requestError) {
			setError(requestError.message);
			setMembers([]);
		}
	}, []);
	useEffect(() => {
		load();
	}, [load]);
	const allowed = (permission) => permission[activeProfile.role] === true;
	return (
		<div className="section-stack">
			<section className="panel" aria-labelledby="access-role-title">
				<header className="panel-header">
					<h3 id="access-role-title">What {roleLabel(activeProfile.role)} can do</h3>
					<p>
						Every rule here is enforced by the API, not just hidden in the UI. Switching profiles changes the role you are
						acting as.
					</p>
				</header>
				<ul className="permission-list">
					{PERMISSIONS.map((permission) => (
						<li key={permission.action} className={allowed(permission) ? "permission-allowed" : "permission-denied"}>
							<MaterialIcon size={18}>{allowed(permission) ? "check_circle" : "error_outline"}</MaterialIcon>
							<span>{permission.action}</span>
							<small>{allowed(permission) ? "Allowed" : "View only"}</small>
						</li>
					))}
				</ul>
			</section>
			<section className="panel" aria-labelledby="access-roster-title">
				<header className="panel-header">
					<h3 id="access-roster-title">Workspace members</h3>
					<p>Every member is available as a profile, so each role can be reviewed without a second sign-in.</p>
				</header>
				{members === null && (
					<div className="panel-status" role="status">
						<span className="profile-loader" />
						Loading members…
					</div>
				)}
				{members !== null && error && (
					<div className="panel-error" role="alert">
						<div>
							<strong>Members couldn’t be loaded</strong>
							<span>{error}</span>
						</div>
						<button type="button" onClick={load}>
							Try again
						</button>
					</div>
				)}
				{members !== null && !error && members.length === 0 && (
					<div className="panel-status">No members are available in this workspace.</div>
				)}
				{members !== null && !error && members.length > 0 && (
					<ul className="member-list">
						{members.map((member) => (
							<li
								key={member._id}
								className={String(member._id) === String(activeProfile._id) ? "member-row member-row-active" : "member-row"}
							>
								<ProfileAvatar profile={member} size="small" />
								<span className="member-identity">
									<strong>
										{member.name}
										{String(member._id) === String(activeProfile._id) && <em> · you</em>}
									</strong>
									<small>{member.title || member.email}</small>
								</span>
								<span className={`role-pill role-pill-${member.role}`}>{roleLabel(member.role)}</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
