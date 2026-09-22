import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { CONSOLE_SECTIONS } from "./console-sections.js";

export function ConsoleSidebar({ activeSection, collapsed = false, onNavigate }) {
	// `inert` while collapsed, so the hidden nav is not reachable by Tab and is dropped from
	// the accessibility tree. On narrow screens the sidebar is a visible strip and never inert.
	return (
		<nav className="console-sidebar" aria-label="Waypoint sections" id="console-navigation" inert={collapsed || undefined}>
			<div className="console-sidebar-inner">
				<ul>
					{CONSOLE_SECTIONS.map((section) => (
						<li key={section.key}>
							<button
								aria-current={section.key === activeSection ? "page" : undefined}
								className="console-nav-item"
								type="button"
								onClick={() => onNavigate(section.key)}
							>
								<MaterialIcon size={20}>{section.icon}</MaterialIcon>
								<span>{section.label}</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</nav>
	);
}
