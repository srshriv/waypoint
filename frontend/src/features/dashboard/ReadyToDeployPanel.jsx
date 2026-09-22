import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";

/**
 * Shown when a workspace has projects but nothing has ever shipped. It reports the readiness
 * numbers that are genuinely there rather than a row of zeros, and points at the next action.
 */
export function ReadyToDeployPanel({ counts, onNavigate }) {
    return <section className="ready-panel" aria-labelledby="ready-title">
        <div className="ready-copy">
            <span className="pending-section-icon"><MaterialIcon size={26}>rocket_launch</MaterialIcon></span>
            <h3 id="ready-title">Everything is set up. Nothing has shipped yet.</h3>
            <p>
                {counts.projects} active {counts.projects === 1 ? "project" : "projects"} with {counts.environments} environments
                and {counts.releases} releases cut are ready to go. No deployment has run, so there is no history to show.
            </p>
            <p className="ready-next">Pick a release and deploy it to the first stage, then promote it up the order.</p>
            <button className="primary-button toolbar-action" type="button" onClick={() => onNavigate("deployments")}>
                <MaterialIcon size={18}>rocket_launch</MaterialIcon>Start a deployment
            </button>
        </div>
    </section>;
}
