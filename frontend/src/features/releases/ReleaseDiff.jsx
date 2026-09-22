import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { formatDate } from "../../shared/utils/format.js";

const CHANGE_MARK = { added: "+", modified: "~", removed: "−" };

export function ReleaseDiff({ diff }) {
    const { from, to, summary, files, releases, reversed } = diff;
    return <section className="panel diff-panel" aria-labelledby="diff-title">
        <header className="panel-header">
            <h3 id="diff-title">{from.version} → {to.version}</h3>
            <p>
                {summary.releaseCount === 1 ? "1 release" : `${summary.releaseCount} releases`} between {formatDate(from.createdAt)} and {formatDate(to.createdAt)}
                {reversed ? " · compared oldest first, so the order was flipped" : ""}
            </p>
        </header>

        <div className="diff-summary">
            <span className="diff-stat diff-stat-added"><strong>{summary.added}</strong> added</span>
            <span className="diff-stat diff-stat-modified"><strong>{summary.modified}</strong> modified</span>
            <span className="diff-stat diff-stat-removed"><strong>{summary.removed}</strong> removed</span>
            <span className="diff-stat"><strong>{summary.fileCount}</strong> files touched</span>
        </div>

        {summary.releaseCount > 0 && <ol className="diff-releases">
            {releases.map((release) => <li key={release._id}>
                <code>{release.version}</code>
                <span className="diff-release-message">{release.commitMessage}</span>
                <small>{release.author} · {formatDate(release.createdAt)}</small>
            </li>)}
        </ol>}

        {files.length === 0 && <div className="panel-status">No files changed between these releases.</div>}

        {files.length > 0 && <ul className="diff-files">
            {files.map((file) => <li className={`diff-file diff-file-${file.netChangeType}`} key={file.path}>
                <span className="diff-mark" aria-hidden="true">{CHANGE_MARK[file.netChangeType]}</span>
                <span className="diff-path">{file.path}</span>
                <span className="diff-net">{file.netChangeType}</span>
                <span className="diff-touched">
                    {file.touchedBy.map((touch) => <span key={`${touch.releaseId}-${touch.changeType}`} title={`${touch.changeType} in ${touch.version}`}>{touch.version}</span>)}
                </span>
            </li>)}
        </ul>}

        <p className="diff-footnote">
            <MaterialIcon size={15}>history</MaterialIcon>
            A file shows as added when it first appeared inside this range, and as removed when its last change here was a deletion.
        </p>
    </section>;
}
