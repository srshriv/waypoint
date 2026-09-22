import { useState } from "react";
import { ConfirmationDialog } from "../../shared/components/ConfirmationDialog.jsx";
import { AccessSection } from "../access/AccessSection.jsx";
import { DashboardSection } from "../dashboard/DashboardSection.jsx";
import { DeploymentsSection } from "../deployments/DeploymentsSection.jsx";
import { EnvironmentsSection } from "../environments/EnvironmentsSection.jsx";
import { ProjectsSection } from "../projects/ProjectsSection.jsx";
import { ReleasesSection } from "../releases/ReleasesSection.jsx";
import { VariablesSection } from "../variables/VariablesSection.jsx";
import { ConsoleHeader } from "./ConsoleHeader.jsx";
import { ConsoleSidebar } from "./ConsoleSidebar.jsx";
import { DEFAULT_SECTION, findSection } from "./console-sections.js";

const SECTION_STORAGE_KEY = "waypoint-section";

export function ConsoleShell({ activeProfile, onLogout, onSwitchProfile }) {
	const [sectionKey, setSectionKey] = useState(() => findSection(localStorage.getItem(SECTION_STORAGE_KEY) || DEFAULT_SECTION).key);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const section = findSection(sectionKey);
	const navigate = (key) => {
		setSectionKey(key);
		localStorage.setItem(SECTION_STORAGE_KEY, key);
	};
	const confirmSignOut = async () => {
		setSigningOut(true);
		await onLogout();
	};
	return (
		<div className={sidebarCollapsed ? "console-shell sidebar-collapsed" : "console-shell"}>
			<ConsoleHeader
				onLogout={() => setSignOutOpen(true)}
				onProfileSwitch={onSwitchProfile}
				onSidebarToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
				profile={activeProfile}
				sidebarCollapsed={sidebarCollapsed}
				title={section.title}
			/>
			<ConsoleSidebar activeSection={section.key} collapsed={sidebarCollapsed} onNavigate={navigate} />
			<main className="console-main" id="console-main" tabIndex={-1}>
				<div className="console-main-inner">
					<div className="section-intro">
						<h2>{section.title}</h2>
						<p>{section.summary}</p>
					</div>
					{section.key === "dashboard" && <DashboardSection activeProfile={activeProfile} onNavigate={navigate} />}
					{section.key === "access" && <AccessSection activeProfile={activeProfile} />}
					{section.key === "projects" && <ProjectsSection />}
					{section.key === "environments" && <EnvironmentsSection activeProfile={activeProfile} />}
					{section.key === "deployments" && <DeploymentsSection activeProfile={activeProfile} />}
					{section.key === "releases" && <ReleasesSection activeProfile={activeProfile} />}
					{section.key === "variables" && <VariablesSection activeProfile={activeProfile} />}
				</div>
			</main>
			{signOutOpen && (
				<ConfirmationDialog
					busy={signingOut}
					confirmLabel="Sign out"
					message="You will need to sign in again to reach this Waypoint workspace."
					title="Sign out of Waypoint?"
					onCancel={() => setSignOutOpen(false)}
					onConfirm={confirmSignOut}
				/>
			)}
		</div>
	);
}
