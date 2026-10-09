/**
 * SSRF-ish safety: only hammer hosts on an explicit allowlist.
 * Default: localhost, 127.0.0.1, plus DEMO_PUBLIC_URL host if set.
 */
export declare function parseAllowlist(envList?: string, demoPublicUrl?: string): Set<string>;
export declare function assertTargetAllowed(target: string, allowlist: Set<string>): URL;
//# sourceMappingURL=stress-allowlist.d.ts.map