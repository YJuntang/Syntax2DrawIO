# Privacy

- Mermaid source is parsed and rendered locally.
- PlantUML preview and visual fallback layers send encoded source to the HTTPS renderer selected in Settings only after consent for that renderer origin.
- Recent diagram source, settings, and the unsaved-replacement "Don't ask again" preference are stored locally in the browser profile or desktop webview profile.
- Recent-history thumbnails are not persisted.
- The project does not include analytics or telemetry.

If a third-party PlantUML renderer is used, its operator may receive the diagram source, IP address, and ordinary request metadata. Configure a trusted self-hosted renderer for sensitive diagrams.
