import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { KIND_LABELS, STATUS_LABELS } from "../deployments/deployment-status.js";

function stateOf(environment) {
    if (environment.activeDeployment) return { tone: "busy", label: `${KIND_LABELS[environment.activeDeployment.kind]} ${STATUS_LABELS[environment.activeDeployment.status].toLowerCase()}` };
    if (environment.release) return { tone: "good", label: "Live" };
    return { tone: "neutral", label: "No release" };
}

export function EnvironmentStatusGrid({ environments }) {
    // Grouped by project so a release manager reads down one pipeline at a time.
    const byProject = new Map();
    for (const environment of environments) {
        const key = environment.project._id;
        if (!byProject.has(key)) byProject.set(key, { project: environment.project, rows: [] });
        byProject.get(key).rows.push(environment);
    }
    const groups = [...byProject.values()].sort((a, b) => a.project.name.localeCompare(b.project.name));

    return <ul className="status-groups">
        {groups.map(({ project, rows }) => <li className="status-group" key={project._id}>
            <h4>{project.name}</h4>
            <ul className="status-rows">
                {rows.map((environment) => {
                    const state = stateOf(environment);
                    return <li className="status-row" key={environment._id}>
                        <span className={`status-dot status-dot-${state.tone}`} aria-hidden="true" />
                        <span className="status-env">{environment.name}</span>
                        <span className="status-release">
                            {environment.release
                                ? <code>{environment.release.version}</code>
                                : <span className="status-none">—</span>}
                        </span>
                        <span className={`status-state status-state-${state.tone}`}>{state.label}</span>
                        {environment.locked && <span className="status-lock" title={environment.leaseExpiresAt ? `Lease until ${new Date(environment.leaseExpiresAt).toLocaleTimeString()}` : "Lock held"}>
                            <MaterialIcon size={13}>lock</MaterialIcon>locked
                        </span>}
                    </li>;
                })}
            </ul>
        </li>)}
    </ul>;
}
