/* global console */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json")),
).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid version");
const exe = path.join(root, "src-tauri/target/release/vrm-explorer.exe");
const runtime = path.join(
  root,
  "build/runtime/Microsoft.WebView2.FixedVersionRuntime.154.0.4258.62.x64",
);
const hash = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const out = path.join(root, "releases");
fs.mkdirSync(out, { recursive: true });
const stamp = Date.now().toString();
for (const mode of ["Offline"]) {
  const name = `VRM-Explorer-${version}-${mode}-win-x64`;
  const stage = path.join(root, "build", `package-${stamp}`, name);
  fs.mkdirSync(stage, { recursive: true });
  fs.copyFileSync(exe, path.join(stage, "vrm-explorer.exe"));
  fs.mkdirSync(path.join(stage, "docs"));
  for (const file of ["portable-release.md", "v1.1-tests.md"])
    fs.copyFileSync(
      path.join(root, "docs", file),
      path.join(stage, "docs", file),
    );
  fs.copyFileSync(
    path.join(root, "scripts/upgrade.ps1"),
    path.join(stage, "upgrade.ps1"),
  );
  const licenses = path.join(stage, "licenses");
  fs.mkdirSync(licenses);
  if (mode === "Offline") {
    const eula = JSON.parse(
      fs.readFileSync(path.join(root, "build/downloads/webview2-eula.json")),
    );
    if (
      !eula.fixedHtml?.includes(
        "MICROSOFT EDGE WEBVIEW2 RUNTIME (FIXED VERSION)",
      )
    )
      throw Error("Official runtime terms missing");
    fs.writeFileSync(
      path.join(licenses, "Microsoft-WebView2-Fixed.html"),
      `<!doctype html><meta charset="utf-8"><title>Microsoft Fixed WebView2 terms</title>${eula.fixedHtml}`,
    );
    fs.writeFileSync(
      path.join(licenses, "runtime-source.json"),
      JSON.stringify(
        {
          download:
            "https://developer.microsoft.com/en-us/microsoft-edge/webview2/",
          terms:
            "https://developer.microsoft.com/microsoft-edge/api/eula/webview2?locale=en-us&fixed=true",
          cabSha256: hash(path.join(root, "build/downloads/webview2.cab")),
        },
        null,
        2,
      ),
    );
  }
  const notices = [];
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json")),
  );
  for (const [location, pkg] of Object.entries(lock.packages)) {
    if (!location || pkg.dev) continue;
    const folder = path.join(root, location);
    const id = location.replaceAll("/", "_");
    notices.push({
      ecosystem: "npm",
      name: location,
      version: pkg.version,
      license: pkg.license,
    });
    for (const file of fs
      .readdirSync(folder)
      .filter((f) => /^(licen[sc]e|notice|copying)(\.|$)/i.test(f))) {
      if (fs.statSync(path.join(folder, file)).isFile())
        fs.copyFileSync(
          path.join(folder, file),
          path.join(licenses, `${id}-${file}`),
        );
    }
  }
  const meta = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--manifest-path",
        path.join(root, "src-tauri/Cargo.toml"),
        "--locked",
        "--format-version",
        "1",
      ],
      { encoding: "utf8", maxBuffer: 20e6 },
    ),
  );
  for (const pkg of meta.packages.filter((p) => p.source)) {
    notices.push({
      ecosystem: "cargo",
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
    });
    const folder = path.dirname(pkg.manifest_path);
    for (const file of fs
      .readdirSync(folder)
      .filter((f) => /^(licen[sc]e|notice|copying)([-.]|$)/i.test(f))) {
      if (fs.statSync(path.join(folder, file)).isFile())
        fs.copyFileSync(
          path.join(folder, file),
          path.join(licenses, `cargo-${pkg.name}-${pkg.version}-${file}`),
        );
    }
  }
  fs.writeFileSync(
    path.join(licenses, "dependencies.json"),
    JSON.stringify(notices, null, 2),
  );
  if (mode === "Offline") {
    if (!fs.existsSync(path.join(runtime, "msedgewebview2.exe")))
      throw Error("Fixed runtime missing");
    fs.cpSync(runtime, path.join(stage, "runtime/webview2"), {
      recursive: true,
    });
  }
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error("Reparse/link rejected");
      if (entry.isDirectory()) walk(p);
      else
        files.push({
          path: path.relative(stage, p).replaceAll("\\", "/"),
          sha256: hash(p),
        });
    }
  }
  walk(stage);
  if (
    files.some(
      (f) =>
        /^(data|src|plugins)\//i.test(f.path) || /\.(vrm|vrma)$/i.test(f.path),
    )
  )
    throw Error("User assets in package");
  fs.writeFileSync(
    path.join(stage, "release.json"),
    JSON.stringify(
      {
        version,
        runtimeMode: mode === "Offline" ? "fixed" : "system",
        runtimeVersion: mode === "Offline" ? "154.0.4258.62" : null,
        minimumOs: "Windows 11 x64",
        qualification: "v1.1; clean offline machine: Not Tested",
        files,
      },
      null,
      2,
    ),
  );
  const zip = path.join(out, `${name}.zip`);
  if (fs.existsSync(zip)) throw Error(`Refusing overwrite: ${zip}`);
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-File", path.join(root, "scripts/zip.ps1"), stage, zip],
    { stdio: "inherit" },
  );
  fs.writeFileSync(`${zip}.sha256`, `${hash(zip)}  ${path.basename(zip)}\n`);
  console.log(zip);
}
