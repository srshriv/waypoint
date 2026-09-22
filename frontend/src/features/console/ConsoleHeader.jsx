import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { roleLabel } from "../../shared/constants/roles.js";
import { applyTheme, readTheme } from "../../shared/utils/theme.js";
import { ProfileAvatar } from "../profiles/ProfileAvatar.jsx";
import { BrandMark } from "./BrandMark.jsx";

export function ConsoleHeader({ onLogout, onProfileSwitch, onSidebarToggle, profile, sidebarCollapsed = false, title }) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [theme, setTheme] = useState(readTheme);
	const anchor = useRef(null);
	useEffect(() => {
		applyTheme(theme);
	}, [theme]);
	useEffect(() => {
		if (!menuOpen) return undefined;
		const closeOutside = (event) => {
			if (!anchor.current?.contains(event.target)) setMenuOpen(false);
		};
		// Escape returns focus to the trigger, so keyboard users are not dropped at the top of
		// the document. Matches how SelectMenu behaves.
		const closeOnEscape = (event) => {
			if (event.key !== "Escape") return;
			setMenuOpen(false);
			anchor.current?.querySelector(".header-profile-button")?.focus();
		};
		document.addEventListener("pointerdown", closeOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [menuOpen]);
	return (
		<header className="console-header">
			<button
				aria-controls="console-navigation"
				aria-expanded={!sidebarCollapsed}
				aria-label="Toggle navigation"
				className="icon-button header-menu"
				type="button"
				onClick={onSidebarToggle}
			>
				<MaterialIcon size={24}>menu</MaterialIcon>
			</button>
			<span className="brand">
				<BrandMark size={36} />
				Waypoint
			</span>
			<h1>{title}</h1>
			<div className="header-actions">
				<div className="profile-menu-anchor" ref={anchor}>
					<button
						aria-expanded={menuOpen}
						aria-haspopup="dialog"
						aria-label={`Waypoint profile: ${profile.name}`}
						className="header-profile-button"
						type="button"
						onClick={() => setMenuOpen((open) => !open)}
					>
						<ProfileAvatar profile={profile} size="small" />
					</button>
					{menuOpen && (
						<div className="profile-menu" role="dialog" aria-label="Profile and appearance">
							<div className="profile-menu-identity">
								<p className="profile-menu-label">WORKING AS</p>
								<ProfileAvatar profile={profile} size="medium" />
								<strong>{profile.name}</strong>
								<span>{profile.email}</span>
								<span className={`role-pill role-pill-${profile.role}`}>{roleLabel(profile.role)}</span>
							</div>
							<div className="profile-menu-appearance">
								<span>Appearance</span>
								<div className="theme-toggle">
									<button aria-pressed={theme === "dark"} type="button" onClick={() => setTheme("dark")}>
										<MaterialIcon size={18}>dark_mode</MaterialIcon>Dark
									</button>
									<button aria-pressed={theme === "light"} type="button" onClick={() => setTheme("light")}>
										<MaterialIcon size={18}>light_mode</MaterialIcon>Light
									</button>
								</div>
							</div>
							<button
								className="profile-switch-button"
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onProfileSwitch();
								}}
							>
								<span className="profile-switch-icon">
									<MaterialIcon size={20}>swap_horiz</MaterialIcon>
								</span>
								<span>
									<strong>Switch profile</strong>
									<small>Review Waypoint as another role</small>
								</span>
								<MaterialIcon size={20}>arrow_drop_down</MaterialIcon>
							</button>
							<button
								className="profile-signout-button"
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onLogout();
								}}
							>
								<MaterialIcon size={20}>logout</MaterialIcon>Sign out of workspace
							</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
