/**
 * Release history per project. Paths are the project's own source tree and the messages track a
 * plausible arc, so a diff between any two releases reads like a real compare view. Change sets
 * are derived deterministically from the slug and release index, which keeps the seed stable
 * across runs while still varying which files each release touches.
 */
export const projectReleaseData = {
    "checkout-api": {
        paths: ["src/cart/cart.service.js", "src/cart/cart.repository.js", "src/orders/order.controller.js", "src/orders/order.service.js", "src/payments/intent.js", "src/payments/webhook.js", "src/shared/idempotency.js", "src/shared/tax.js", "config/routes.json"],
        messages: ["Cut the first production build of the checkout pipeline", "Add idempotency keys to order placement", "Split payment intent creation from capture", "Fix tax rounding on multi-currency carts", "Rework cart persistence for guest checkout"],
    },
    "payments-gateway": {
        paths: ["src/processors/stripe.js", "src/processors/adyen.js", "src/retry/backoff.js", "src/settlement/reconcile.js", "src/settlement/ledger.js", "src/shared/currency.js", "src/webhooks/verify.js", "config/processors.json"],
        messages: ["First gateway build with a single processor", "Add Adyen as a second processor", "Exponential backoff on processor timeouts", "Nightly settlement reconciliation", "Drop the legacy ledger writer"],
    },
    "legacy-billing-sync": {
        paths: ["src/export/nightly.js", "src/export/format.js", "src/mainframe/connection.js", "src/shared/retry.js"],
        messages: ["Initial nightly export job", "Handle mainframe connection resets", "Freeze the export format ahead of retirement"],
    },
    "identity-service": {
        paths: ["src/sessions/issue.js", "src/sessions/revoke.js", "src/tokens/jwt.js", "src/tokens/rotation.js", "src/membership/workspace.js", "src/membership/invite.js", "src/shared/password.js", "config/providers.json"],
        messages: ["First identity build with password sign-in", "Add refresh token rotation", "Workspace membership and invites", "Tighten password hashing parameters", "Revoke sessions on membership change"],
    },
    "notification-hub": {
        paths: ["src/channels/email.js", "src/channels/push.js", "src/channels/in-app.js", "src/throttle/bucket.js", "src/templates/render.js", "src/shared/queue.js", "config/channels.json"],
        messages: ["Transactional email delivery", "Add push as a second channel", "Per-channel throttling buckets", "In-app inbox delivery", "Template rendering moved off the hot path"],
    },
    "inventory-service": {
        paths: ["src/stock/levels.js", "src/stock/adjustments.js", "src/reservations/hold.js", "src/reservations/release.js", "src/backorder/projection.js", "src/shared/warehouse.js", "config/warehouses.json"],
        messages: ["Stock levels and adjustments", "Warehouse reservations with holds", "Release expired reservations automatically", "Backorder projections per warehouse", "Split adjustments from level reads"],
    },
    "search-indexer": {
        paths: ["src/pipeline/incremental.js", "src/pipeline/full-rebuild.js", "src/mapping/catalog.js", "src/mapping/analyzers.js", "src/shared/batching.js", "config/index-settings.json"],
        messages: ["Incremental catalog indexing", "Nightly full rebuild", "Custom analyzers for product titles", "Batch writes to reduce index pressure"],
    },
    "storefront-web": {
        paths: ["src/pages/product.jsx", "src/pages/category.jsx", "src/pages/cart.jsx", "src/components/AddToCart.jsx", "src/components/PriceTag.jsx", "src/server/render.js", "src/styles/product.css", "config/routes.js"],
        messages: ["First storefront build", "Server-render product and category pages", "Cart page and add-to-cart flow", "Price formatting for multi-currency", "Retire the client-only category route"],
    },
    "design-system": {
        paths: ["src/tokens/color.js", "src/tokens/spacing.js", "src/components/Button.jsx", "src/components/Dialog.jsx", "src/components/Field.jsx", "src/a11y/focus-ring.js", "docs/usage.md"],
        messages: ["Design tokens and the first components", "Accessible dialog with focus trapping", "Focus ring primitive across components", "Field component with validation states", "Spacing scale reworked to a 4px base"],
    },
    "edge-router": {
        paths: ["src/tls/terminate.js", "src/routing/rules.js", "src/routing/weights.js", "src/failover/region.js", "src/shared/health.js", "config/regions.json"],
        messages: ["TLS termination and basic routing", "Weighted routing between origins", "Regional failover", "Health probes drive origin weights", "Drop the static region table"],
    },
    "observability-stack": {
        paths: ["src/metrics/collector.js", "src/traces/span.js", "src/traces/sampler.js", "src/logs/aggregate.js", "src/logs/retention.js", "src/shared/labels.js", "config/retention.json"],
        messages: ["Metrics collection", "Distributed tracing spans", "Tail-based sampling", "Log aggregation and retention policy", "Unified label schema across signals"],
    },
};

export const RELEASE_VERSIONS = ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "2.0.0"];

const fnv1a = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const commitShaFor = (slug, version) => fnv1a(`${slug}@${version}`).toString(16).padStart(8, "0").repeat(2).slice(0, 12);

/** First release adds the core files; later ones touch a varied, deterministic slice. */
export function changesFor(slug, paths, index) {
    if (index === 0) {
        return paths.slice(0, Math.min(4, paths.length)).map((path) => ({ path, changeType: "added" }));
    }
    const hash = fnv1a(`${slug}:${index}`);
    const count = 2 + (hash % 3);
    const start = hash % paths.length;
    const picked = [];
    for (let step = 0; step < count; step += 1) {
        const path = paths[(start + step * 3) % paths.length];
        if (!picked.includes(path)) picked.push(path);
    }
    return picked.map((path, position) => {
        const roll = (hash >>> (position * 3)) % 10;
        const changeType = roll < 6 ? "modified" : roll < 9 ? "added" : "removed";
        return { path, changeType };
    });
}
