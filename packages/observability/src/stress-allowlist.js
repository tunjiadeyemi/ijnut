"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAllowlist = parseAllowlist;
exports.assertTargetAllowed = assertTargetAllowed;
/**
 * SSRF-ish safety: only hammer hosts on an explicit allowlist.
 * Default: localhost, 127.0.0.1, plus DEMO_PUBLIC_URL host if set.
 */
function parseAllowlist(envList, demoPublicUrl) {
    const hosts = new Set();
    const raw = (envList ?? "127.0.0.1,localhost")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    for (const h of raw)
        hosts.add(h);
    if (demoPublicUrl) {
        try {
            const u = new URL(demoPublicUrl);
            hosts.add(u.hostname.toLowerCase());
        }
        catch {
            // ignore bad DEMO_PUBLIC_URL
        }
    }
    return hosts;
}
function assertTargetAllowed(target, allowlist) {
    let url;
    try {
        url = new URL(target);
    }
    catch {
        throw new Error(`Invalid target URL: ${target}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Only http/https targets are allowed");
    }
    const host = url.hostname.toLowerCase();
    if (!allowlist.has(host)) {
        throw new Error(`Target host "${host}" is not allowlisted. Allowed: ${[...allowlist].join(", ")}`);
    }
    return url;
}
//# sourceMappingURL=stress-allowlist.js.map