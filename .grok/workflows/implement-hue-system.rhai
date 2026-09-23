let meta = #{
    name: "implement-hue-system",
    description: "Stand up Hue console + XIAO firmware (Vercel, Supabase, Cloudflare, first user, config.h, flash) so BOOT can be assigned on the site",
    when_to_use: "Implement hue-switch-console and hue-simple-switch through infra and first device so the user only assigns BOOT",
    phases: [
        #{ title: "Infra", detail: "Supabase, Vercel, Cloudflare hue.tineira.com, first user" },
        #{ title: "Console API", detail: "Auth, API keys, register, snapshot, recipes" },
        #{ title: "Build", detail: "English UI and firmware in parallel" },
        #{ title: "Wire", detail: "config.h, device key, compile, upload" },
        #{ title: "Verify", detail: "spec alignment of both repos" },
    ],
};

let impl_schema = #{
    "type": "object",
    "required": ["ok", "summary", "blockers"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "blockers": #{ "type": "array", "items": #{ "type": "string" } },
        "artifact": #{ "type": "string" },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["pass", "issues"],
    "properties": #{
        "pass": #{ "type": "boolean" },
        "issues": #{ "type": "array", "items": #{ "type": "string" } },
    },
};

fn impl_ok(r) {
    r != () && r.success && r.output != () && r.output.ok != false
}

fn impl_blockers(r) {
    let out = [];
    if r == () || !r.success || r.output == () {
        out.push("agent failed or returned no usable output");
        return out;
    }
    if r.output.ok == false {
        if r.output.blockers != () {
            for b in r.output.blockers { out.push(b); }
        }
        if out.len() == 0 { out.push("ok=false with no blockers listed"); }
    }
    out
}

fn blocker_text(items) {
    if items.len() == 0 { return "(none)"; }
    json_encode(items)
}

let spec = "C:\\Users\\tinei\\hue-switch-console\\docs\\definitions.md";
let console_root = "C:\\Users\\tinei\\hue-switch-console";
let fw_root = "C:\\Users\\tinei\\Arduino\\hue-simple-switch";
let site = "https://hue.tineira.com";
let com_port = "COM3";
let skip_flash = false;
if args != () {
    if args.com_port != () { com_port = args.com_port; }
    if args.skip_flash == true { skip_flash = true; }
}

// --- Infra ---
phase("Infra");
log("Creating Supabase, Vercel, Cloudflare, and the first console user");

let infra_p = "";
infra_p += "You MUST use tools (read_file, grep, run_terminal_command). Do not answer from memory.\n";
infra_p += "Goal: production URL ";
infra_p += site;
infra_p += " serves the Next.js app, Supabase holds Auth+Postgres, first human user exists.\n";
infra_p += "Spec (read fully): ";
infra_p += spec;
infra_p += "\nConsole repo: ";
infra_p += console_root;
infra_p += "\nFirmware repo (do not mix trees; do not git init parent Arduino): ";
infra_p += fw_root;
infra_p += "\n\nDO ALL OF THIS (idempotent if already exists):\n";
infra_p += "1. Read ";
infra_p += console_root;
infra_p += "\\.env.local and .env.example. USER_EMAIL and USER_PASSWORD are the first account. Never print the password in full. Never commit .env.local or config.h.\n";
infra_p += "2. SUPABASE: create or reuse a project for hue-switch-console. Enable email+password. Disable public signup if the API allows. Create tables named in the spec (device_api_keys, bridges, switches, recipes) with RLS so a user only sees rows tied to their device keys. Seed the first Auth user from USER_EMAIL / USER_PASSWORD. Put NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in ";
infra_p += console_root;
infra_p += "\\.env.local (create keys if missing).\n";
infra_p += "3. VERCEL: log in if needed (`npx vercel login` may require the user — if so set ok=false and list that blocker). Link ";
infra_p += console_root;
infra_p += " to GitHub tineira/hue-switch-console (private). Set the same env vars on Vercel (Production). Deploy.\n";
infra_p += "4. CLOUDFLARE: DNS for tineira.com — CNAME `hue` to the Vercel target (often cname.vercel-dns.com) so ";
infra_p += site;
infra_p += " works with TLS. Use wrangler if authenticated; otherwise document the exact DNS record and set ok=false if you could not apply it.\n";
infra_p += "5. Add CONSOLE_URL=";
infra_p += site;
infra_p += " to .env.local. Do not add CONSOLE_TOKEN yet.\n";
infra_p += "Return ok=true only if a browser could in principle hit the deploy host (Vercel URL at minimum) and Supabase accepts the seeded user. blockers is a string array.\n";

let infra = agent(infra_p, #{
    label: "infra",
    capability_mode: "all",
    output_schema: impl_schema,
});
if !impl_ok(infra) {
    let msg = "Infra incomplete. Fix Vercel/Supabase/Cloudflare (or log in), then resume this workflow. Blockers: ";
    msg += blocker_text(impl_blockers(infra));
    await_user("infra", msg);
}

// --- Console API ---
phase("Console API");
log("Auth, API keys, device register/snapshot/config");

let api_p = "";
api_p += "You MUST use tools. Working directory for all edits: ";
api_p += console_root;
api_p += "\nRead ";
api_p += spec;
api_p += " before writing. Also read existing app/, lib/, package.json.\n";
api_p += "This session's default AGENTS.md may be the Arduino firmware — IGNORE firmware-only rules. Do not edit ";
api_p += fw_root;
api_p += ".\n\n";
api_p += "Implement the console BACKEND + auth shell (English UI copy):\n";
api_p += "- Supabase Auth session for humans. No public signup. Seeded user logs in with email+password.\n";
api_p += "- API keys UI + server: create (show secret ONCE), list (name+prefix), revoke. Store SHA-256, never the raw key.\n";
api_p += "- Device Bearer token (the API key): POST register with mac, firmware, bridgeid, bridge_ip, channels[], rich snapshot (lights, rooms with grouped_light_id and light_ids, scenes with group_rtype/group_rid). GET config returns {rev, recipes[]}. PUT recipes from the logged-in user for a switch.\n";
api_p += "- Replace the old INGEST_TOKEN file store as source of truth; Postgres is source of truth.\n";
api_p += "- Write exact HTTP paths, headers, and JSON examples to ";
api_p += console_root;
api_p += "\\docs\\device-api.md so the firmware agent can implement against it. Include CONSOLE_URL=";
api_p += site;
api_p += " and that device TLS must VERIFY (not setInsecure).\n";
api_p += "- Product UI language: English only.\n";
api_p += "Do not skip writing device-api.md. Return ok=true only if that file exists and APIs are in the repo.\n";

let api = agent(api_p, #{
    label: "console-api",
    capability_mode: "all",
    output_schema: impl_schema,
});
if !impl_ok(api) {
    let msg = "Console API incomplete. Resume after fixing. Blockers: ";
    msg += blocker_text(impl_blockers(api));
    await_user("verification", msg);
}

// --- Parallel UI + firmware ---
phase("Build");
log("English assignment UI and XIAO firmware in parallel");

let ui_p = "";
ui_p += "You MUST use tools. Edit only ";
ui_p += console_root;
ui_p += "\nRead ";
ui_p += spec;
ui_p += " and ";
ui_p += console_root;
ui_p += "\\docs\\device-api.md before writing.\n";
ui_p += "Ignore Arduino AGENTS.md. Product UI MUST be English.\n\n";
ui_p += "Implement the commissioning UI end-to-end so a logged-in user can:\n";
ui_p += "1. Log in (email/password).\n";
ui_p += "2. Manage device API keys (create/list/revoke).\n";
ui_p += "3. See the Bridge workspace: left = switches and channels (boot momentary; d0/d1/d2 maintained); right = topology grouped by room (grouped_light, lights, scenes).\n";
ui_p += "4. Assign recipes per channel+event (on/off/double_click; short for BOOT). Shortcut: Use this room for on and off. Empty slots allowed. Confirmation sentence in English.\n";
ui_p += "Spend time on empty/error/unassigned/saved states. Design, use, critique, fix before finishing.\n";
ui_p += "Do not call the Hue Bridge from the server. Do not invent a Home entity.\n";
ui_p += "Return ok=true only if login, keys, and assignment screens exist in code.\n";

let fw_p = "";
fw_p += "You MUST use tools. Edit only ";
fw_p += fw_root;
fw_p += "\nRead ";
fw_p += spec;
fw_p += " and ";
fw_p += console_root;
fw_p += "\\docs\\device-api.md (the contract — follow those paths exactly).\n";
fw_p += "Read hue-simple-switch.ino, hue.h, hue_discover.h, config.example.h, AGENTS.md.\n\n";
fw_p += "Implement firmware so the XIAO, after Wi-Fi + Hue mDNS/pair (already there):\n";
fw_p += "1. config.example.h comments for CONSOLE_URL and CONSOLE_TOKEN; do not put secrets in git. Add those defines to config.h (gitignored) ONLY if the wire agent has not; you may leave placeholders your successor will fill.\n";
fw_p += "2. Channels: boot GPIO9 momentary; d0/d1/d2 GPIO 0/1/2 maintained; pull-up, closed=LOW.\n";
fw_p += "3. HTTPS to CONSOLE_URL with certificate VERIFY (Arduino cert bundle). setInsecure only for the Hue Bridge.\n";
fw_p += "4. POST register (mac, firmware, bridgeid, ip, channels, rich snapshot from Clip v2: lights, rooms+grouped_light, scenes). GET config; if rev newer, REPLACE entire NVS recipe array. Poll 1 min if no recipes, else boot+every 1 hour.\n";
fw_p += "5. GPIO: load NVS recipes before sampling. First sample sets level only (no synthetic on/off). Maintained double-click machine from the spec (wait window; empty double_click falls back to on). BOOT long 3s = Hue re-pair, not a recipe. BOOT short = recipe if any.\n";
fw_p += "6. Execute recipes locally against the Bridge (on/off/recall_scene/toggle). GPIO path never hits Vercel.\n";
fw_p += "7. Compile with: arduino-cli compile --profile xiao-c6 .  in ";
fw_p += fw_root;
fw_p += "\nUSB CDC: Serial.setTxTimeoutMs(0) must remain.\n";
fw_p += "Return ok=true only if compile succeeds.\n";

let built = parallel([
    #{
        prompt: ui_p,
        label: "console-ui",
        capability_mode: "all",
        output_schema: impl_schema,
    },
    #{
        prompt: fw_p,
        label: "firmware",
        capability_mode: "all",
        output_schema: impl_schema,
    },
]);

let build_blockers = [];
if built.len() > 0 { for b in impl_blockers(built[0]) { build_blockers.push(b); } }
if built.len() > 1 { for b in impl_blockers(built[1]) { build_blockers.push(b); } }
if build_blockers.len() > 0 {
    let msg = "UI or firmware incomplete. Resume after fixing. Blockers: ";
    msg += blocker_text(build_blockers);
    await_user("verification", msg);
}

// --- Wire config.h, mint device key, flash ---
phase("Wire");
log("Mint device API key, write config.h, compile, upload");

let wire_p = "";
wire_p += "You MUST use tools. Spec: ";
wire_p += spec;
wire_p += "\nConsole: ";
wire_p += console_root;
wire_p += "\nFirmware: ";
wire_p += fw_root;
wire_p += "\nSerial port: ";
wire_p += com_port;
wire_p += "\n\n";
wire_p += "1. Using Supabase service role from console .env.local, create a device API key for the seeded user (same rules as the app: store hash, keep raw only for config.h). Do not commit the raw key. Do not echo it in git.\n";
wire_p += "2. Update ";
wire_p += fw_root;
wire_p += "\\config.h (gitignored) to keep existing WIFI_SSID/WIFI_PASSWORD and ADD:\n";
wire_p += "   #define CONSOLE_URL \"";
wire_p += site;
wire_p += "\"\n   #define CONSOLE_TOKEN \"<raw key>\"\n";
wire_p += "3. Match config.example.h comments (placeholders only).\n";
wire_p += "4. arduino-cli compile --profile xiao-c6 . in the firmware dir.\n";
if skip_flash {
    wire_p += "5. skip_flash is set — do NOT upload. Set artifact to compile-only.\n";
} else {
    wire_p += "5. Stop anything holding the port (Arduino serial-monitor). arduino-cli upload --profile xiao-c6 -p ";
    wire_p += com_port;
    wire_p += " .\nIf the port is missing, set ok=false and name the port in blockers.\n";
}
wire_p += "Never git add config.h. Return ok=true if compile succeeded";
if !skip_flash { wire_p += " and upload succeeded"; }
wire_p += ".\n";

let wire = agent(wire_p, #{
    label: "wire-flash",
    capability_mode: "all",
    output_schema: impl_schema,
});
if !impl_ok(wire) {
    let msg = "Flash/config incomplete. Plug the XIAO, close Serial Monitor, resume. Blockers: ";
    msg += blocker_text(impl_blockers(wire));
    await_user("infra", msg);
}

if !skip_flash {
    await_user("user", "Board should be running. If Hue pairing is needed, press the Bridge link button (LED blinks). Then open https://hue.tineira.com , log in with the seeded account, assign BOOT (short) to a room or light, and try the physical BOOT key. Resume when that works or if it failed.");
}

// --- Verify ---
phase("Verify");
log("Spec check on both repos");

let v_console = "";
v_console += "Read-only. Adversarially check ";
v_console += console_root;
v_console += " against ";
v_console += spec;
v_console += " and device-api.md. Use read_file/grep. Product UI must be English. Must not call the Hue Bridge. Assignment is per channel+event. Set pass=true only with evidence you read. issues[] otherwise.\n";

let v_fw = "";
v_fw += "Read-only. Adversarially check ";
v_fw += fw_root;
v_fw += " against ";
v_fw += spec;
v_fw += " and ";
v_fw += console_root;
v_fw += "\\docs\\device-api.md. Confirm channels, poll intervals, TLS verify to console, setInsecure only for Hue, NVS replace-all recipes, no synthetic GPIO events at boot, double-click fallback to on, config.h gitignored. Use read_file/grep. pass=true only with evidence.\n";

let verified = parallel([
    #{
        prompt: v_console,
        label: "verify-console",
        capability_mode: "read-only",
        output_schema: verdict_schema,
    },
    #{
        prompt: v_fw,
        label: "verify-firmware",
        capability_mode: "read-only",
        output_schema: verdict_schema,
    },
]);

let issues = [];
for r in verified {
    if r == () || !r.success || r.output == () {
        issues.push("verifier failed");
    } else if r.output.pass != true {
        if r.output.issues != () {
            for i in r.output.issues { issues.push(i); }
        } else {
            issues.push("verifier did not pass");
        }
    }
}

let report = "";
report += "# implement-hue-system\n\n";
report += "Site: ";
report += site;
report += "\nWhen you return: log in, assign BOOT, press BOOT on the XIAO.\n\n";
if issues.len() > 0 {
    report += "Verifier issues:\n";
    report += json_encode(issues);
    report += "\n";
} else {
    report += "Both verifiers passed.\n";
}

let path = write_scratch_file("report.md", report);
complete(#{
    summary: "Implementation workflow finished. Assign BOOT at " + site,
    site: site,
    issues: issues,
    path: path,
});
