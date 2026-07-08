# Contributing

1. Open an issue for substantial behavior changes.
2. Add parser fixtures for every syntax change, including malformed and lossy cases.
3. Run `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build`, and `cargo check --manifest-path src-tauri/Cargo.toml`.
4. Never label an export editable when rendered content is omitted. Use structured diagnostics and hybrid fallback.
5. Do not add network transmission without an explicit user disclosure and consent path.

Pull requests should describe supported syntax, expected Draw.io fidelity, security implications, and browser/desktop verification.
