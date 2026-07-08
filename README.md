# Syntax2DrawIO

[Use the web app](https://syntax2drawio.pages.dev)

Syntax2DrawIO converts Mermaid and PlantUML source into Draw.io files in the web app or Tauri desktop shell. Supported constructs become native editable shapes; partially supported diagrams retain editable content plus a hidden locked visual reference so missing fidelity is never silent.

Native PlantUML families include sequence, class, component, and use case diagrams. The bundled example catalog intentionally exercises complex editable diagrams rather than minimal syntax samples.

## Development

Requirements: Node.js LTS, npm, Rust stable, and the platform prerequisites for Tauri 2.

```bash
npm ci
npm run dev
npm test -- --run
npm run lint
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Copy `.env.example` to `.env.local` if the public repository URL differs from the default.

## PlantUML privacy

Mermaid renders locally. PlantUML preview and visual fallback layers require an HTTPS renderer and transmit the diagram source to that renderer only after first-use consent for its exact origin. Consent can be revoked in Settings. See [PRIVACY.md](PRIVACY.md).

## Export fidelity

- **Editable:** all detected content was converted to native Draw.io cells.
- **Hybrid:** recognized content is editable and the original rendering is retained on a hidden locked reference layer.
- **Visual only:** no safe native representation was available.

The in-app diagnostics panel lists limitations for the current diagram. A broader matrix is in [SUPPORT.md](SUPPORT.md).

## Releases

The web app is hosted on Cloudflare Pages. The quality workflow runs lint, typecheck, tests, and build on pushes and pull requests. Tagged `desktop-v*` builds create draft macOS and Windows releases. Initial desktop binaries are unsigned, so Gatekeeper or SmartScreen may warn.

## License

[MIT](LICENSE)
