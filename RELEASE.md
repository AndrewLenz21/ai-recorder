# Releasing AI Recorder

GitHub Actions builds installers when you push a version tag. Users download them from **Releases**.

## Version

Keep these three files on the same version (currently `0.1.0`):

- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`

## Publish

1. Update the version in the three files above if needed.
2. Commit the changes.
3. Tag the commit:

   ```sh
   git tag v0.1.0
   ```

4. Push the tag:

   ```sh
   git push origin v0.1.0
   ```

5. Wait for the **Release** workflow on GitHub Actions.
6. Open [Releases](https://github.com/AndrewLenz21/ai-recorder/releases) and confirm the installers.

The tag name becomes the GitHub release (`AI Recorder v0.1.0`). Release notes are generated from commits since the previous tag.

## Signing

The first public builds are **unsigned**.

| Platform | Status |
| --- | --- |
| macOS | Ad-hoc identity (`-`) only. Not notarized. Gatekeeper may warn. |
| Windows | Unsigned. SmartScreen may warn. |
| Linux | No code signing configured. |

To add signing later, store certificates and passwords in GitHub Actions secrets. Do not commit keys or `.p12` / `.pfx` files. See [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/) and [Windows signing](https://v2.tauri.app/distribute/sign/windows/).
