# Project rules

The authoritative specification is `VRM_Explorer_Codex_Development_Spec.md` at the repository root (the `_Final.md` name inside its example is stale).

- Implement and report one phase at a time. Stop at the phase boundary.
- Windows desktop, Portable First; no silent AppData fallback.
- Read-only original assets. Rust brokers all filesystem access.
- UI text uses i18n; zh-TW default and complete English.
- No external JavaScript, DLL plugins, eval or remote runtime code.
- Verify APIs against official sources. Report unexecuted tests as Not Tested.
- Preserve existing user files and data. Never package user data into releases.
- No agent delegation is required for this project.
