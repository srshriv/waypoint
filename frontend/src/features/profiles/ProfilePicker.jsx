import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { roleLabel } from "../../shared/constants/roles.js";
import { BrandMark } from "../console/BrandMark.jsx";
import { ProfileAvatar } from "./ProfileAvatar.jsx";

export function ProfilePicker({ error = "", loading = false, onLogout, onRetry, onSelect, profiles = [], switchingFrom = null }) {
    return <main className="profile-picker-page">
        <section className="profile-picker-card" aria-labelledby="profile-picker-title">
            <div className="profile-picker-mark"><BrandMark size={40} /></div>
            <h1 id="profile-picker-title">Choose a profile</h1>
            <p className="profile-picker-subtitle">to continue to Waypoint</p>
            {switchingFrom && <p className="profile-picker-current">Working as {switchingFrom.name}</p>}
            {loading && <div className="profile-picker-status" role="status"><span className="profile-loader" />Loading profiles…</div>}
            {!loading && error && <div className="profile-picker-error" role="alert"><div><strong>Profiles couldn’t be loaded</strong><span>{error}</span></div><button type="button" onClick={onRetry}>Try again</button></div>}
            {!loading && !error && <ul className="profile-account-list">
                {profiles.map((profile) => <li key={profile._id}>
                    <button className="profile-account" type="button" onClick={() => onSelect(profile)} aria-label={`Continue as ${profile.name}, ${roleLabel(profile.role)}`}>
                        <ProfileAvatar profile={profile} size="small" />
                        <span><strong>{profile.name}</strong><small>{profile.email}</small></span>
                        <span className={`role-pill role-pill-${profile.role}`}>{roleLabel(profile.role)}</span>
                    </button>
                </li>)}
                <li>
                    <button className="profile-account profile-account-signout" type="button" onClick={onLogout}>
                        <span className="profile-account-icon"><MaterialIcon size={20}>logout</MaterialIcon></span>
                        <span><strong>Sign out of workspace</strong></span>
                    </button>
                </li>
            </ul>}
            {!loading && !error && profiles.length === 0 && <div className="profile-picker-status">{switchingFrom ? "No other profiles are available." : "No profiles are available."}</div>}
        </section>
        <footer className="workspace-login-footer"><span>Waypoint deployment and release console</span><span>English (United States)</span></footer>
    </main>;
}
