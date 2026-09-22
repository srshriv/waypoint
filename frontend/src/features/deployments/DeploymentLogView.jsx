import { useEffect, useRef } from "react";

export function DeploymentLogView({ lines, live }) {
    const endReference = useRef(null);
    const scrollReference = useRef(null);
    const pinnedReference = useRef(true);

    // Follow the tail only while the reader has not scrolled away from the bottom.
    useEffect(() => {
        const node = scrollReference.current;
        if (!node) return undefined;
        const onScroll = () => {
            pinnedReference.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40;
        };
        node.addEventListener("scroll", onScroll);
        return () => node.removeEventListener("scroll", onScroll);
    }, []);
    useEffect(() => {
        if (pinnedReference.current) endReference.current?.scrollIntoView({ block: "end" });
    }, [lines.length]);

    return <div className="log-view" ref={scrollReference} role="log" aria-live="polite" aria-label="Build log">
        {lines.length === 0 && <p className="log-empty">Waiting for the worker to pick this deployment up…</p>}
        <ol className="log-lines">
            {lines.map((line) => <li className={`log-line log-line-${line.level}`} key={line.sequence}>
                <span className="log-sequence" aria-hidden="true">{String(line.sequence).padStart(3, "0")}</span>
                <span className="log-message">{line.message}</span>
            </li>)}
        </ol>
        {live && <p className="log-tail" aria-hidden="true"><span className="log-cursor" />streaming</p>}
        <div ref={endReference} />
    </div>;
}
