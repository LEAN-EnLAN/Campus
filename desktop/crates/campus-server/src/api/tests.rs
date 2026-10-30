//! Scenarios ported from `src/server/vault-api.test.ts`, `vault-api-errors`,
//! `vault-api-roots`, `vault-api-dirs` and `vault-api-create` tests.

use std::fs;
use std::path::{Path, PathBuf};

use super::*;

const TOKEN: &str = "test-capability";
const ORIGIN: &str = "http://127.0.0.1:4815";

struct Fx {
    _tmp: tempfile::TempDir,
    home: PathBuf,
    outside: PathBuf,
    sessions: VaultSessions,
    options: ApiOptions,
}

fn fx() -> Fx {
    let tmp = tempfile::tempdir().unwrap();
    let home = campus_core::fs::realpath(tmp.path()).unwrap().join("home");
    let outside = home.parent().unwrap().join("outside");
    fs::create_dir_all(home.join("Campus")).unwrap();
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("secret.txt"), "secreto").unwrap();
    Fx {
        sessions: VaultSessions::new(vec![home.clone()]),
        options: ApiOptions {
            allowed_origins: crate::origins::loopback_origins("http", 4815),
            token: TOKEN.into(),
        },
        _tmp: tmp,
        home,
        outside,
    }
}

fn link_dir(target: &Path, link: &Path) {
    #[cfg(windows)]
    if std::os::windows::fs::symlink_dir(target, link).is_err() {
        junction::create(target, link).unwrap();
    }
    #[cfg(not(windows))]
    std::os::unix::fs::symlink(target, link).unwrap();
}

impl Fx {
    fn raw(&self, method: &str, url: &str, headers: &[(&str, &str)], body: &str) -> Response {
        let req = Request {
            method: method.into(),
            url: url.into(),
            headers: headers
                .iter()
                .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
                .collect(),
            body: body.as_bytes().to_vec(),
        };
        handle(&req, &self.sessions, &self.options)
    }

    fn post(&self, url: &str, body: Value) -> (u16, Value) {
        let r = self.raw(
            "POST",
            url,
            &[("origin", ORIGIN), ("x-campus-capability", TOKEN)],
            &body.to_string(),
        );
        (r.status, r.json_body())
    }

    fn open(&self, path: &Path) -> String {
        let (s, v) = self.post(
            "/__campus/vault/open",
            json!({ "path": path.to_string_lossy() }),
        );
        assert_eq!(s, 200, "{v}");
        v["id"].as_str().unwrap().to_owned()
    }

    fn op(&self, id: &str, body: Value) -> (u16, Value) {
        self.post(&format!("/__campus/vault/{id}/op"), body)
    }
}

// ------------------------------------------- a manipulated payload is refused

#[test]
fn hostile_paths_are_refused_by_the_vault_with_their_code() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    let cases = [
        (
            f.outside.join("secret.txt").to_string_lossy().into_owned(),
            "path_absolute",
        ),
        ("../../outside/secret.txt".into(), "path_traversal"),
        ("a/../../..".into(), "path_traversal"),
        ("..\\..\\outside\\secret.txt".into(), "path_traversal"),
        ("CON.md".into(), "name_reserved"),
    ];
    for (path, code) in cases {
        let (s, v) = f.op(&id, json!({ "op": "readNote", "path": path }));
        assert_eq!((s, v["code"].as_str().unwrap()), (400, code), "{path}");
        assert_eq!(v["notFound"], false);
        assert_eq!(v["conflict"], false);
    }
}

#[test]
fn a_symlinked_directory_escape_is_outside_vault_and_writes_nothing() {
    let f = fx();
    link_dir(&f.outside, &f.home.join("Campus").join("escape"));
    let id = f.open(&f.home.join("Campus"));
    let (s, v) = f.op(
        &id,
        json!({ "op": "readNote", "path": "escape/secret.txt" }),
    );
    assert_eq!((s, v["code"].as_str().unwrap()), (400, "outside_vault"));
    let (s, _) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "escape/x.md", "contents": "x", "expectedMtimeMs": null }),
    );
    assert_eq!(s, 400);
    assert!(!f.outside.join("x.md").exists());
}

#[test]
fn an_ordinary_round_trip_works_and_stale_writes_conflict() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    let (s, v) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "Materias/nota.md", "contents": "# hola", "expectedMtimeMs": null }),
    );
    assert_eq!((s, v.clone()), (200, json!({ "ok": true, "value": null })));

    let (_, v) = f.op(&id, json!({ "op": "readNote", "path": "Materias/nota.md" }));
    assert_eq!(v["ok"], true);
    assert_eq!(v["value"]["contents"], "# hola");
    let mtime = v["value"]["mtimeMs"].as_f64().unwrap();

    let (s, v) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "Materias/nota.md", "contents": "x", "expectedMtimeMs": mtime - 5000.0 }),
    );
    assert_eq!(s, 400);
    assert_eq!(v["code"], "conflict_changed");
    assert_eq!(v["conflict"], true);
    assert_eq!(v["error"], "the file changed on disk after it was loaded");

    let (s, _) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "Materias/nota.md", "contents": "v2", "expectedMtimeMs": mtime }),
    );
    assert_eq!(s, 200);
}

#[test]
fn creating_over_an_existing_note_is_already_exists_named_once() {
    let f = fx();
    fs::write(f.home.join("Campus/a.md"), "x").unwrap();
    let id = f.open(&f.home.join("Campus"));
    let (s, v) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "a.md", "contents": "y", "expectedMtimeMs": null }),
    );
    assert_eq!(s, 400);
    assert_eq!(v["code"], "already_exists");
    assert_eq!(
        v["error"],
        "expected a new file, but one already exists on disk"
    );
}

// ------------------------------------------------ the endpoint is not open

#[test]
fn refuses_an_unlisted_origin_before_the_capability() {
    let f = fx();
    let r = f.raw(
        "POST",
        "/__campus/vault/open",
        &[("origin", "https://evil.example")],
        "{}",
    );
    assert_eq!(r.status, 403);
    assert_eq!(r.json_body()["code"], "origin_not_allowed");
    assert_eq!(r.header("access-control-allow-origin"), None);
}

#[test]
fn never_answers_with_a_wildcard_and_echoes_only_listed_origins() {
    let f = fx();
    let r = f.raw("OPTIONS", "/__campus/vault/open", &[("origin", ORIGIN)], "");
    assert_eq!(r.status, 204);
    assert_eq!(r.header("access-control-allow-origin"), Some(ORIGIN));
    assert_eq!(
        r.header("access-control-allow-headers"),
        Some("content-type, x-campus-capability")
    );
    let (_, _) = f.post("/__campus/vault/exists", json!({ "path": "x" }));
    let r = f.raw(
        "POST",
        "/__campus/vault/exists",
        &[("x-campus-capability", TOKEN)],
        "{}",
    );
    assert_eq!(r.header("access-control-allow-origin"), None);
}

#[test]
fn refuses_a_missing_or_wrong_capability() {
    let f = fx();
    for headers in [
        vec![("origin", ORIGIN)],
        vec![("origin", ORIGIN), ("x-campus-capability", "nope")],
    ] {
        let r = f.raw("POST", "/__campus/vault/open", &headers, "{\"path\":\"x\"}");
        assert_eq!(r.status, 401);
        assert_eq!(
            r.json_body(),
            json!({ "ok": false, "code": "unauthorized", "error": "missing or invalid capability" })
        );
    }
}

#[test]
fn refuses_get_and_unknown_endpoints_and_unknown_vaults() {
    let f = fx();
    let r = f.raw(
        "GET",
        "/__campus/vault/open",
        &[("x-campus-capability", TOKEN)],
        "",
    );
    assert_eq!(
        (r.status, r.json_body()["error"].clone()),
        (405, json!("method not allowed"))
    );
    let (s, v) = f.post("/__campus/vault/realpath", json!({}));
    assert_eq!((s, v["error"].clone()), (404, json!("unknown endpoint")));
    let (s, v) = f.op("doesnotexist", json!({ "op": "readNote", "path": "a.md" }));
    assert_eq!((s, v["code"].clone()), (404, json!("unknown_vault")));
}

#[test]
fn a_session_cannot_be_redirected_by_extra_payload_fields() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    let (_, v) = f.op(
        &id,
        json!({ "op": "readNote", "path": "secret.txt", "root": f.outside.to_string_lossy(), "vault": f.outside.to_string_lossy() }),
    );
    assert_eq!(v["notFound"], true);
}

// ------------------------------------------------ the wire is VaultAccess

#[test]
fn refuses_operations_outside_vault_access_and_bad_types() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    for op in ["realpath", "remove", "readdir", "lstat", "exec", "list"] {
        let (s, v) = f.op(&id, json!({ "op": op, "path": "a" }));
        assert_eq!(
            (s, v["error"].clone()),
            (400, json!("unsupported operation")),
            "{op}"
        );
    }
    let (s, v) = f.op(&id, json!({ "op": "readNote", "path": 5 }));
    assert_eq!(
        (s, v["error"].clone()),
        (400, json!("path must be a string"))
    );
    let (_, v) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "a.md", "contents": 1, "expectedMtimeMs": null }),
    );
    assert_eq!(v["error"], "contents must be a string");
    for bad in [json!("1"), json!(true), json!({})] {
        let (_, v) = f.op(
            &id,
            json!({ "op": "writeNote", "path": "a.md", "contents": "x", "expectedMtimeMs": bad }),
        );
        assert_eq!(v["error"], "expectedMtimeMs must be a number or null");
    }
    let (_, v) = f.op(
        &id,
        json!({ "op": "writeNote", "path": "a.md", "contents": "x" }),
    );
    assert_eq!(v["error"], "expectedMtimeMs must be a number or null");
    let (_, v) = f.op(&id, json!({ "op": "rename", "path": "a.md" }));
    assert_eq!(v["error"], "to must be a string");
    let r = f.raw(
        "POST",
        &format!("/__campus/vault/{id}/op"),
        &[("x-campus-capability", TOKEN)],
        "{not json",
    );
    assert_eq!(
        (r.status, r.json_body()["error"].clone()),
        (400, json!("invalid JSON"))
    );
}

#[test]
fn list_mkdir_rename_trash_stat_over_the_wire() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    let (s, _) = f.op(&id, json!({ "op": "mkdir", "path": "Materias" }));
    assert_eq!(s, 200);
    f.op(
        &id,
        json!({ "op": "writeNote", "path": "a.md", "contents": "aa", "expectedMtimeMs": null }),
    );
    f.op(
        &id,
        json!({ "op": "writeNote", "path": "b.md", "contents": "b", "expectedMtimeMs": null }),
    );

    let (_, v) = f.op(&id, json!({ "op": "listDir", "path": "" }));
    let names: Vec<_> = v["value"]
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["name"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(names, vec!["Materias", "a.md", "b.md"]);
    assert_eq!(v["value"][1]["kind"], "file");
    assert_eq!(v["value"][1]["size"], 2);

    let (s, v) = f.op(&id, json!({ "op": "rename", "path": "a.md", "to": "b.md" }));
    assert_eq!(
        (s, v["code"].clone(), v["conflict"].clone()),
        (400, json!("destination_exists"), json!(true))
    );
    assert_eq!(v["error"], "the destination already exists");

    let (_, v) = f.op(&id, json!({ "op": "trash", "path": "b.md" }));
    assert!(
        v["value"]["trashedTo"]
            .as_str()
            .unwrap()
            .starts_with(".campus/trash/")
    );
    let (_, v) = f.op(&id, json!({ "op": "stat", "path": "b.md" }));
    assert_eq!(v, json!({ "ok": true, "value": null }));
    let (_, v) = f.op(&id, json!({ "op": "stat", "path": "Materias" }));
    assert_eq!(v["value"]["kind"], "dir");
}

#[test]
fn absence_is_a_value_not_a_protocol_error() {
    let f = fx();
    let id = f.open(&f.home.join("Campus"));
    let (s, v) = f.op(
        &id,
        json!({ "op": "readNote", "path": ".campus/academic/items.json" }),
    );
    assert_eq!(s, 200);
    assert_eq!(
        v,
        json!({ "ok": false, "notFound": true, "code": "not_found", "error": "not found", "conflict": false })
    );
    let (s, v) = f.op(
        &id,
        json!({ "op": "rename", "path": "missing.md", "to": "x.md" }),
    );
    assert_eq!((s, v["code"].clone()), (200, json!("not_found")));
}

// --------------------------------------------------------------- opening

#[test]
fn open_returns_an_opaque_id_and_the_folder_name() {
    let f = fx();
    let (s, v) = f.post(
        "/__campus/vault/open",
        json!({ "path": f.home.join("Campus").to_string_lossy() }),
    );
    assert_eq!(s, 200);
    assert_eq!(v["name"], "Campus");
    let id = v["id"].as_str().unwrap();
    assert_eq!(id.len(), 22);
    assert!(!id.contains("Campus"));
}

#[test]
fn open_refusals_carry_folder_codes_and_statuses() {
    let f = fx();
    fs::write(f.home.join("file.txt"), "x").unwrap();
    let cases = [
        (json!({ "path": "relativo" }), 400, "folder_not_absolute"),
        (
            json!({ "path": f.home.join("missing").to_string_lossy() }),
            404,
            "folder_not_found",
        ),
        (
            json!({ "path": f.home.join("file.txt").to_string_lossy() }),
            404,
            "folder_not_directory",
        ),
        (
            json!({ "path": f.outside.to_string_lossy() }),
            403,
            "folder_outside_roots",
        ),
        (
            json!({ "path": f.outside.join("missing").to_string_lossy() }),
            403,
            "folder_outside_roots",
        ),
        (
            json!({ "path": f.home.join("..").join("outside").to_string_lossy() }),
            403,
            "folder_outside_roots",
        ),
    ];
    for (body, status, code) in cases {
        let (s, v) = f.post("/__campus/vault/open", body.clone());
        assert_eq!((s, v["code"].as_str().unwrap()), (status, code), "{body}");
    }
    let (s, v) = f.post("/__campus/vault/open", json!({}));
    assert_eq!((s, v["error"].clone()), (400, json!("path required")));
}

#[test]
fn open_refuses_a_link_inside_home_that_points_out() {
    let f = fx();
    link_dir(&f.outside, &f.home.join("link-out"));
    let (s, v) = f.post(
        "/__campus/vault/open",
        json!({ "path": f.home.join("link-out").to_string_lossy() }),
    );
    assert_eq!((s, v["code"].clone()), (403, json!("folder_outside_roots")));
    link_dir(&f.home.join("Campus"), &f.home.join("link-in"));
    let (s, _) = f.post(
        "/__campus/vault/open",
        json!({ "path": f.home.join("link-in").to_string_lossy() }),
    );
    assert_eq!(s, 200);
}

#[test]
fn open_with_create_makes_exactly_one_level_inside_the_roots() {
    let f = fx();
    let target = f.home.join("Nuevo");
    let (s, v) = f.post(
        "/__campus/vault/open",
        json!({ "path": target.to_string_lossy(), "create": true }),
    );
    assert_eq!((s, v["name"].clone()), (200, json!("Nuevo")));
    assert!(target.is_dir());

    let deep = f.home.join("a").join("b");
    let (s, v) = f.post(
        "/__campus/vault/open",
        json!({ "path": deep.to_string_lossy(), "create": true }),
    );
    assert_eq!((s, v["code"].clone()), (404, json!("folder_not_found")));
    assert!(!f.home.join("a").exists());

    let out = f.outside.join("new");
    let (s, _) = f.post(
        "/__campus/vault/open",
        json!({ "path": out.to_string_lossy(), "create": true }),
    );
    assert_eq!(s, 403);
    assert!(!out.exists());

    let (s, v) = f.post(
        "/__campus/vault/open",
        json!({ "path": target.to_string_lossy(), "create": "yes" }),
    );
    assert_eq!(
        (s, v["error"].clone()),
        (400, json!("create must be a boolean"))
    );
}

#[test]
fn exists_never_reveals_anything_outside_the_roots() {
    let f = fx();
    let ask = |p: &Path| {
        f.post(
            "/__campus/vault/exists",
            json!({ "path": p.to_string_lossy() }),
        )
        .1["exists"]
            .clone()
    };
    assert_eq!(ask(&f.home.join("Campus")), json!(true));
    assert_eq!(ask(&f.home.join("missing")), json!(false));
    assert_eq!(ask(&f.outside), json!(false));
    assert_eq!(ask(&f.outside.join("missing")), json!(false));
}

// --------------------------------------------------------------- dirs

#[test]
fn dirs_lists_folder_names_only_sorted_hiding_dot_folders() {
    let f = fx();
    for d in ["zeta", "Álgebra", ".ssh", "beta"] {
        fs::create_dir_all(f.home.join(d)).unwrap();
    }
    fs::write(f.home.join("notes.txt"), "x").unwrap();
    link_dir(&f.outside, &f.home.join("out-link"));
    link_dir(&f.home.join("beta"), &f.home.join("in-link"));
    let (s, v) = f.post("/__campus/vault/dirs", json!({}));
    assert_eq!(s, 200);
    assert_eq!(v["path"], json!(f.home.to_string_lossy()));
    assert_eq!(v["parent"], Value::Null);
    assert_eq!(
        v["dirs"],
        json!(["Álgebra", "beta", "Campus", "in-link", "zeta"])
    );

    let (_, v) = f.post(
        "/__campus/vault/dirs",
        json!({ "path": f.home.join("beta").to_string_lossy() }),
    );
    assert_eq!(v["parent"], json!(f.home.to_string_lossy()));

    let (s, v) = f.post(
        "/__campus/vault/dirs",
        json!({ "path": f.outside.to_string_lossy() }),
    );
    assert_eq!((s, v["code"].clone()), (403, json!("folder_outside_roots")));
    let (s, v) = f.post("/__campus/vault/dirs", json!({ "path": 3 }));
    assert_eq!(
        (s, v["error"].clone()),
        (400, json!("path must be a string"))
    );
}

#[test]
fn dirs_with_no_usable_root_lists_nothing() {
    let sessions = VaultSessions::new(vec![]);
    let options = ApiOptions {
        allowed_origins: vec![],
        token: TOKEN.into(),
    };
    let req = Request {
        method: "POST".into(),
        url: "/__campus/vault/dirs".into(),
        headers: vec![("x-campus-capability".into(), TOKEN.into())],
        body: b"{}".to_vec(),
    };
    let r = handle(&req, &sessions, &options);
    assert_eq!(
        (r.status, r.json_body()["code"].clone()),
        (403, json!("folder_outside_roots"))
    );
}

#[test]
fn js_numbers_serialise_like_json_stringify() {
    assert_eq!(js_number(1_730_301_234_567.0).to_string(), "1730301234567");
    assert_eq!(
        js_number(1_730_301_234_567.123_4).to_string(),
        "1730301234567.1233"
    );
}
