//! The local Vault API. Port of `src/server/vault-api.ts` (`handleVaultRequest`).
//!
//! Transport-agnostic on purpose, like the original: the Tauri custom protocol
//! and the loopback `campus-serve` binary both mount this same function. Path
//! safety is NOT re-derived here — every relative path goes through
//! `VaultRepository`, the single authority.
//!
//! Refusals are ordered most-hostile-first: wrong origin, then missing
//! capability, then method, and only then is the body parsed.

use campus_core::VaultSessions;
use campus_core::errors::{ErrorCode, VaultError};
use campus_core::repo::{VaultEntry, VaultStat};
use campus_core::sessions::random_token;
use serde_json::{Map, Value, json};

pub const PREFIX: &str = "/__campus/vault";

/// Exactly `VaultAccess`. Adding to this list is adding to the attack surface.
const OPERATIONS: [&str; 7] = [
    "readNote",
    "writeNote",
    "listDir",
    "mkdir",
    "rename",
    "trash",
    "stat",
];

#[derive(Debug, Clone)]
pub struct Request {
    pub method: String,
    /// Path and query only, e.g. `/__campus/vault/abc/op`.
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Request {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    pub fn path(&self) -> &str {
        self.url.split('?').next().unwrap_or("")
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Response {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    pub fn json_body(&self) -> Value {
        serde_json::from_slice(&self.body).unwrap_or(Value::Null)
    }
}

pub struct ApiOptions {
    /// Origins allowed to talk to this API. Never `*`.
    pub allowed_origins: Vec<String>,
    /// Per-process capability. Anything without it is refused before parsing.
    pub token: String,
}

/// A fresh capability, minted once per process and never persisted.
pub fn mint_token() -> String {
    random_token(32)
}

/// A JS number as JSON: integral values print without `.0`, like `JSON.stringify`.
pub fn js_number(n: f64) -> Value {
    if n.fract() == 0.0 && n.abs() < 9_007_199_254_740_992.0 {
        json!(n as i64)
    } else {
        json!(n)
    }
}

fn json_response(status: u16, value: &Value, origin: Option<&str>) -> Response {
    let mut headers = vec![("content-type".to_owned(), "application/json".to_owned())];
    if let Some(o) = origin {
        headers.push(("access-control-allow-origin".into(), o.into()));
        headers.push(("vary".into(), "Origin".into()));
    }
    headers.push(("cache-control".into(), "no-store".into()));
    Response {
        status,
        headers,
        body: serde_json::to_vec(value).expect("json"),
    }
}

fn refusal(status: u16, code: ErrorCode, message: &str, origin: Option<&str>) -> Response {
    json_response(
        status,
        &json!({ "ok": false, "code": code.as_str(), "error": message }),
        origin,
    )
}

/// HTTP status for a refusal while opening or browsing a folder.
fn folder_status(code: ErrorCode) -> u16 {
    match code {
        ErrorCode::FolderOutsideRoots | ErrorCode::PermissionDenied => 403,
        ErrorCode::FolderNotAbsolute => 400,
        _ => 404,
    }
}

fn entry_json(e: &VaultEntry) -> Value {
    json!({
        "name": e.name,
        "kind": e.kind.as_str(),
        "mtimeMs": js_number(e.mtime_ms),
        "size": e.size,
    })
}

fn stat_json(s: &VaultStat) -> Value {
    json!({ "kind": s.kind.as_str(), "mtimeMs": js_number(s.mtime_ms), "size": s.size })
}

fn bad(reply: &dyn Fn(u16, Value) -> Response, error: &str) -> Response {
    reply(
        400,
        json!({ "ok": false, "code": "bad_request", "error": error }),
    )
}

/// Handle one request.
pub fn handle(req: &Request, sessions: &VaultSessions, options: &ApiOptions) -> Response {
    let origin = req.header("origin");
    let allowed = origin.is_some_and(|o| options.allowed_origins.iter().any(|a| a == o));

    // A same-origin fetch may send no Origin; a PRESENT unlisted one is refused.
    if origin.is_some() && !allowed {
        return refusal(403, ErrorCode::OriginNotAllowed, "origin not allowed", None);
    }
    let echo = if allowed { origin } else { None };

    if req.method == "OPTIONS" {
        let mut headers = Vec::new();
        if let Some(o) = echo {
            headers.push(("access-control-allow-origin".into(), o.to_owned()));
            headers.push(("vary".into(), "Origin".into()));
        }
        headers.push(("access-control-allow-methods".into(), "POST".into()));
        headers.push((
            "access-control-allow-headers".into(),
            "content-type, x-campus-capability".into(),
        ));
        headers.push(("access-control-max-age".into(), "600".into()));
        return Response {
            status: 204,
            headers,
            body: vec![],
        };
    }

    if req.header("x-campus-capability") != Some(options.token.as_str()) {
        return refusal(
            401,
            ErrorCode::Unauthorized,
            "missing or invalid capability",
            echo,
        );
    }
    if req.method != "POST" {
        return refusal(405, ErrorCode::BadRequest, "method not allowed", echo);
    }

    let reply = |status: u16, value: Value| json_response(status, &value, echo);

    let text = String::from_utf8_lossy(&req.body);
    let text = if text.is_empty() { "{}" } else { &text };
    let payload: Map<String, Value> = match serde_json::from_str::<Value>(text) {
        // A non-object payload has no fields, exactly as property access on a
        // JS primitive yields `undefined`.
        Ok(Value::Object(m)) => m,
        Ok(_) => Map::new(),
        Err(_) => return bad(&reply, "invalid JSON"),
    };
    let field = |k: &str| payload.get(k);
    let path = req.path();

    // --- open: the one and only place an absolute path is accepted --------
    if path == format!("{PREFIX}/open") {
        let target = match field("path") {
            Some(Value::String(s)) if !s.is_empty() => s.clone(),
            _ => return bad(&reply, "path required"),
        };
        let create = match field("create") {
            None => false,
            Some(Value::Bool(b)) => *b,
            Some(_) => return bad(&reply, "create must be a boolean"),
        };
        return match sessions.open(&target, create) {
            Ok(v) => reply(200, json!({ "id": v.id, "name": v.name })),
            Err(e) => reply(
                folder_status(e.code),
                json!({ "ok": false, "code": e.code.as_str(), "error": e.message }),
            ),
        };
    }

    if path == format!("{PREFIX}/exists") {
        let Some(Value::String(target)) = field("path") else {
            return bad(&reply, "path required");
        };
        return reply(200, json!({ "exists": sessions.exists(target) }));
    }

    // --- dirs: browse folders (names only) to choose a vault --------------
    if path == format!("{PREFIX}/dirs") {
        let target = match field("path") {
            None => None,
            Some(Value::String(s)) => Some(s.as_str()),
            Some(_) => return bad(&reply, "path must be a string"),
        };
        return match sessions.list_dirs(target) {
            Ok(l) => reply(
                200,
                json!({ "path": l.path, "parent": l.parent, "dirs": l.dirs }),
            ),
            Err(e) => reply(
                folder_status(e.code),
                json!({ "ok": false, "code": e.code.as_str(), "error": e.message }),
            ),
        };
    }

    // --- everything else is vault-scoped and relative ---------------------
    let Some(id) = path
        .strip_prefix(&format!("{PREFIX}/"))
        .and_then(|rest| rest.strip_suffix("/op"))
        .filter(|id| {
            !id.is_empty()
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        })
    else {
        return reply(
            404,
            json!({ "ok": false, "code": "bad_request", "error": "unknown endpoint" }),
        );
    };

    // An unknown id is refused rather than reopened from the payload.
    let Some(repo) = sessions.get(id) else {
        return reply(
            404,
            json!({ "ok": false, "code": "unknown_vault", "error": "unknown vault" }),
        );
    };

    let op = match field("op") {
        Some(Value::String(op)) if OPERATIONS.contains(&op.as_str()) => op.as_str(),
        _ => return bad(&reply, "unsupported operation"),
    };
    let Some(Value::String(relative)) = field("path") else {
        return bad(&reply, "path must be a string");
    };

    let result: Result<Value, VaultError> = match op {
        "readNote" => repo
            .read_note(relative)
            .map(|n| json!({ "contents": n.contents, "mtimeMs": js_number(n.mtime_ms) })),
        "writeNote" => {
            let Some(Value::String(contents)) = field("contents") else {
                return bad(&reply, "contents must be a string");
            };
            let expected = match field("expectedMtimeMs") {
                Some(Value::Null) => None,
                Some(Value::Number(n)) => n.as_f64(),
                _ => return bad(&reply, "expectedMtimeMs must be a number or null"),
            };
            repo.write_note(relative, contents, expected)
                .map(|()| Value::Null)
        }
        "listDir" => repo
            .list_dir(relative)
            .map(|entries| Value::Array(entries.iter().map(entry_json).collect())),
        "mkdir" => repo.mkdir(relative).map(|()| Value::Null),
        "rename" => {
            let Some(Value::String(to)) = field("to") else {
                return bad(&reply, "to must be a string");
            };
            repo.rename(relative, to).map(|()| Value::Null)
        }
        "trash" => repo
            .trash(relative)
            .map(|t| json!({ "trashedTo": t.trashed_to })),
        "stat" => repo
            .stat(relative)
            .map(|s| s.as_ref().map_or(Value::Null, stat_json)),
        _ => unreachable!("op is one of OPERATIONS"),
    };

    match result {
        Ok(value) => reply(200, json!({ "ok": true, "value": value })),
        Err(e) => {
            // Absence is the ordinary state of a fresh vault, not a protocol
            // error; security refusals keep their own code and a 400.
            let not_found = e.code == ErrorCode::NotFound;
            let conflict = e.is_conflict();
            let error = e.conflict.clone().unwrap_or(e.message);
            reply(
                if not_found { 200 } else { 400 },
                json!({
                    "ok": false,
                    "notFound": not_found,
                    "code": e.code.as_str(),
                    "error": error,
                    "conflict": conflict,
                }),
            )
        }
    }
}

#[cfg(test)]
mod tests;
