/* global console, process, Buffer */
import fs from "node:fs";
import path from "node:path";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, ".."),
  version = JSON.parse(
    fs.readFileSync(path.join(root, "package.json")),
  ).version;
const stage = path.resolve(process.argv[2] ?? "");
if (!process.argv[2] || !stage.startsWith(path.join(root, "build") + path.sep))
  throw Error("Supply the completed Portable stage inside build/");
const release = JSON.parse(fs.readFileSync(path.join(stage, "release.json")));
if (release.version !== version) throw Error("Stage version mismatch");
const out = path.join(root, "releases"),
  work = fs.mkdtempSync(path.join(root, "build", "update-artifacts-"));
const privateFile =
  process.env.VRM_UPDATE_SIGNING_KEY ??
  path.join(root, "build/signing/update-private.pem");
const key = createPrivateKey(fs.readFileSync(privateFile)),
  publicBytes = createPublicKey(key)
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
if (
  publicBytes !==
  fs
    .readFileSync(path.join(root, "src-tauri/update-public-key.txt"), "utf8")
    .trim()
)
  throw Error("Signing key does not match the embedded public key");
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function bundle(runtime) {
  const suffix = runtime ? "Runtime" : "Update",
    file = `VRM-Explorer-${version}-${suffix}-win-x64.zip`,
    destination = path.join(out, file);
  const paths = release.files
    .map((e) => e.path)
    .filter((p) =>
      runtime ? p.startsWith("runtime/webview2/") : !p.startsWith("runtime/"),
    );
  if (!runtime) paths.push("release.json");
  if (
    paths.some(
      (p) =>
        /^(data|src|build|plugins)\//i.test(p) ||
        /\.(vrm|vrma|pem|key|db|sqlite)$/i.test(p),
    )
  )
    throw Error("User data or signing material in update bundle");
  const entries = path.join(work, suffix + ".json");
  fs.writeFileSync(entries, JSON.stringify(paths));
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-File",
      path.join(root, "scripts/zip-update.ps1"),
      stage,
      destination,
      entries,
    ],
    { stdio: "inherit" },
  );
  fs.writeFileSync(destination + ".sha256", `${hash(destination)}  ${file}\n`);
  return {
    url: `https://github.com/kappalien/VRMExplorer/releases/download/v${version}/${file}`,
    size: fs.statSync(destination).size,
    sha256: hash(destination),
    files: paths.map((p) => ({
      path: p,
      size: fs.statSync(path.join(stage, p)).size,
      sha256: hash(path.join(stage, p)),
    })),
  };
}
const app = bundle(false),
  runtime = process.argv.includes("--with-runtime") ? bundle(true) : null;
const notes = JSON.parse(
  fs.readFileSync(path.join(root, "docs/update-notes.json"), "utf8"),
);
const payload = Buffer.from(
  JSON.stringify({
    schemaVersion: 1,
    version,
    target: "windows-x64",
    minUpdater: 1,
    runtimeVersion: release.runtimeVersion,
    notesZh: notes.zh,
    notesEn: notes.en,
    app,
    runtime,
  }),
);
const signature = sign(null, payload, key);
if (!verify(null, payload, createPublicKey(key), signature))
  throw Error("Signature self verification failed");
const feedDir = path.join(out, `v${version}`);
fs.mkdirSync(feedDir, { recursive: true });
fs.writeFileSync(
  path.join(feedDir, "update.json"),
  JSON.stringify(
    {
      payload: payload.toString("base64"),
      signature: signature.toString("base64"),
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  `Signed update bundle: ${(app.size / 1048576).toFixed(2)} MiB; Runtime ${runtime ? "separate bundle" : "unchanged, excluded"}`,
);
