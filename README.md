# Syntax2DrawIO

[Use the web app](https://syntax2drawio.pages.dev)

Syntax2DrawIO turns Mermaid and PlantUML source into draw.io diagrams. Supported constructs become native editable draw.io shapes, while partially supported diagrams retain editable content plus a hidden locked visual reference so missing fidelity is never silent.

## Features

- Convert Mermaid and PlantUML source into `.drawio` files.
- Copy generated draw.io diagrams directly to the clipboard.
- Export PNGs with embedded draw.io source.
- Keep supported diagram content editable as native draw.io cells.
- Preserve partial diagrams with hybrid exports that include a hidden locked visual reference.
- Use the web app in a browser or the Tauri desktop shell locally.

## How to use

1. Open the [web app](https://syntax2drawio.pages.dev).
2. Paste or import Mermaid or PlantUML source.
3. Review the preview and diagnostics.
4. Export a `.drawio` file, copy the diagram, or export a PNG.

## Diagram support

High-editability support includes Mermaid flowchart, sequence, class, and ER diagrams, plus PlantUML sequence, class, component, and use case diagrams.

Other Mermaid and PlantUML families may export as visual-only diagrams or hybrid diagrams. The in-app diagnostics panel is authoritative for the current diagram. A broader matrix is in [SUPPORT.md](SUPPORT.md).

## Export fidelity

- **Editable:** all detected content was converted to native draw.io cells.
- **Hybrid:** recognized content is editable and the original rendering is retained on a hidden locked reference layer.
- **Visual only:** no safe native representation was available.

## Privacy

Mermaid renders locally. PlantUML preview and visual fallback layers require an HTTPS renderer and transmit the diagram source to that renderer only after first-use consent for its exact origin. Consent can be revoked in Settings. See [PRIVACY.md](PRIVACY.md).

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

## Releases

The web app is hosted on Cloudflare Pages. The quality workflow runs lint, typecheck, tests, and build on pushes and pull requests. Tagged `desktop-v*` builds create draft macOS and Windows releases. Initial desktop binaries are unsigned, so Gatekeeper or SmartScreen may warn.

## License

[MIT](LICENSE)
