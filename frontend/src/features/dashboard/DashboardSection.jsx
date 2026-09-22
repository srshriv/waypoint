import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { identityInitials } from "../../shared/utils/identity.js";
import { KIND_LABELS, STATUS_LABELS, STATUS_TONE } from "../deployments/deployment-status.js";
import { EnvironmentStatusGrid } from "./EnvironmentStatusGrid.jsx";
import { ReadyToDeployPanel } from "./ReadyToDeployPanel.jsx";
import { dashboardApi } from "./dashboard.api.js";

const POLL_MS = 5000;

const relativeTime = (value) => {
    const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86_400)}d ago`;
};

function StatTile({ label, value, hint }) {
    return <li className="stat-tile">
        <strong>{value}</strong>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
    </li>;
}

export function DashboardSection({ activeProfile, onNavigate }) {
    const [overview, setOverview] = useState(null);
    const [error, setError] = useState("");
    const [refreshedAt, setRefreshedAt] = useState(null);
    const mounted = useRef(true);

    const load = useCallback(async ({ quiet = false } = {}) => {
        try {
            if (!quiet) setOverview(null);
            setError("");
            const data = await dashboardApi.overview();
            if (!mounted.current) return;
            setOverview(data);
            setRefreshedAt(new Date());
        } catch (requestError) {
            if (mounted.current) { setError(requestError.message); setOverview((current) => current); }
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        load();
        const timer = setInterval(() => load({ quiet: true }), POLL_MS);
        return () => { mounted.current = false; clearInterval(timer); };
    }, [load]);

    if (overview === null && !error) {
        return <div className="panel panel-status" role="status"><span className="profile-loader" />Loading the console…</div>;
    }
    if (overview === null) {
        return <div className="panel-error" role="alert">
            <div><strong>The dashboard couldn’t be loaded</strong><span>{error}</span></div>
            <button type="button" onClick={() => load()}>Try again</button>
        </div>;
    }

    const { counts, queue, environments, activity } = overview;
    const noProjects = counts.projects === 0;
    const neverDeployed = counts.deploymentsTotal === 0;
    const queueBusy = queue.pending + queue.running;

    return <div className="section-stack">
        {error && <div className="panel-error" role="alert">
            <div><strong>Refresh failed</strong><span>{error} Showing the last good reading.</span></div>
            <button type="button" onClick={() => load()}>Retry</button>
        </div>}

        {noProjects && <div className="pending-section">
            <span className="pending-section-icon"><MaterialIcon size={28}>layers</MaterialIcon></span>
            <h3>Nothing to watch yet</h3>
            <p>You do not own any active projects. Create one, give it environments, and this page will show what is running where.</p>
            <button className="primary-button toolbar-action" type="button" onClick={() => onNavigate("projects")}>Go to projects</button>
        </div>}

        {!noProjects && neverDeployed && <ReadyToDeployPanel counts={counts} onNavigate={onNavigate} />}

        {!noProjects && !neverDeployed && <ul className="stat-row">
            <StatTile label="Active projects" value={counts.projects} hint={counts.archivedProjects ? `${counts.archivedProjects} archived` : null} />
            <StatTile label="Environments live" value={`${counts.environmentsWithRelease}/${counts.environments}`} hint="holding a release" />
            <StatTile label="Releases cut" value={counts.releases} />
            <StatTile label="Deployments today" value={counts.deploymentsToday} hint={`${counts.deploymentsTotal} all time`} />
            <StatTile
                label="Success rate"
                value={counts.successRate ? `${counts.successRate.rate}%` : "—"}
                hint={counts.successRate
                    ? `last ${counts.successRate.windowDays} days, ${counts.successRate.sample} finished`
                    : "no finished deployments yet"}
            />
        </ul>}

        {!noProjects && <section className="panel" aria-labelledby="queue-title">
            <header className="panel-header">
                <h3 id="queue-title">Worker queue</h3>
                <p>The background worker that runs every deployment. Retries use exponential backoff, so a waiting job is not necessarily a stuck one.</p>
            </header>
            <ul className="queue-strip">
                <li className={queue.running ? "queue-stat queue-stat-busy" : "queue-stat"}><strong>{queue.running}</strong><span>running</span></li>
                <li className="queue-stat"><strong>{queue.pending}</strong><span>pending</span></li>
                <li className={queue.retried ? "queue-stat queue-stat-warn" : "queue-stat"}><strong>{queue.retried}</strong><span>retried</span></li>
                <li className={queue.failed ? "queue-stat queue-stat-bad" : "queue-stat"}><strong>{queue.failed}</strong><span>failed</span></li>
                <li className="queue-stat"><strong>{queue.succeeded}</strong><span>succeeded</span></li>
            </ul>
            {!queueBusy && <p className="queue-note">The queue is idle.</p>}
            {Boolean(queueBusy) && queue.oldestPendingAt && <p className="queue-note">Oldest waiting job queued {relativeTime(queue.oldestPendingAt)}.</p>}
        </section>}

        {!noProjects && <section className="panel" aria-labelledby="status-title">
            <header className="panel-header">
                <h3 id="status-title">Environment status</h3>
                <p>What is live where, across all {counts.projects} of your active projects. Archived projects are not shown.</p>
            </header>
            <EnvironmentStatusGrid environments={environments} />
        </section>}

        {!noProjects && !neverDeployed && <section className="panel" aria-labelledby="activity-title">
            <header className="panel-header">
                <h3 id="activity-title">Recent activity</h3>
                <p>The last {activity.length} deployments across every project, newest first.</p>
            </header>
            <ul className="activity-list">
                {activity.map((entry) => <li className="activity-row" key={entry._id}>
                    <span className={`status-dot status-dot-${STATUS_TONE[entry.status]}`} aria-hidden="true" />
                    <span className="activity-main">
                        <strong>{KIND_LABELS[entry.kind]} · {entry.release ? entry.release.version : "unknown release"}</strong>
                        <small>{entry.project.name} → {entry.environment.name}</small>
                    </span>
                    <span className={`status-pill status-pill-${STATUS_TONE[entry.status]}`}>{STATUS_LABELS[entry.status]}</span>
                    {entry.triggeredBy && <span className="activity-who" title={entry.triggeredBy.name}>
                        <span className="profile-avatar profile-avatar-small" style={{ "--profile-color": entry.triggeredBy.avatarColor }} aria-hidden="true">
                            <span>{identityInitials(entry.triggeredBy.name)}</span>
                        </span>
                    </span>}
                    <span className="activity-when">{relativeTime(entry.queuedAt)}</span>
                </li>)}
            </ul>
        </section>}

        {refreshedAt && <p className="refresh-note">
            Refreshing every {POLL_MS / 1000}s · last updated {refreshedAt.toLocaleTimeString()} · viewing as {activeProfile.name}
        </p>}
    </div>;
}
