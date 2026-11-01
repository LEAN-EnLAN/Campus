//! `campus-serve` — the built Campus app plus its Vault API on loopback.
//!
//! The browser-facing twin of the desktop shell, and the server the
//! Node-vs-Rust contract test talks to.
//!
//! ```text
//! campus-serve --dist ../dist [--port 4815] [--host 127.0.0.1]
//! ```
//!
//! Environment: `CAMPUS_VAULT_ALLOWED_ROOTS`, `CAMPUS_VAULT_ALLOWED_ORIGINS`
//! (same meaning as the dev server), and `CAMPUS_VAULT_TOKEN` (tests only: pin
//! the capability instead of minting one).

use std::process::ExitCode;

use campus_server::bind::assert_loopback_bind;
use campus_server::origins::{ALLOWED_ORIGINS_ENV, vault_allowed_origins};
use campus_server::{ApiOptions, Campus, DirAssets, Request, api};

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1).cloned())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();
    let dist = arg(&args, "--dist").unwrap_or_else(|| "dist".into());
    let port: u16 = arg(&args, "--port")
        .and_then(|p| p.parse().ok())
        .unwrap_or(4815);
    let host = arg(&args, "--host");

    if let Err(e) = assert_loopback_bind(host.as_deref()) {
        eprintln!("{e}");
        return ExitCode::from(2);
    }
    let bind_host = host.unwrap_or_else(|| "127.0.0.1".into());

    let (roots, rejected) = Campus::roots_from_env();
    for entry in &rejected {
        eprintln!(
            "[campus] CAMPUS_VAULT_ALLOWED_ROOTS: ignored \"{entry}\" (needs an absolute path other than the filesystem root)"
        );
    }
    if roots.is_empty() {
        eprintln!(
            "[campus] CAMPUS_VAULT_ALLOWED_ROOTS has no usable entry: no folder can be opened"
        );
    }

    let token = std::env::var("CAMPUS_VAULT_TOKEN").unwrap_or_else(|_| api::mint_token());
    let allowed_origins = vault_allowed_origins(
        "http",
        port,
        std::env::var(ALLOWED_ORIGINS_ENV).ok().as_deref(),
    );
    let campus = Campus::new(
        roots,
        ApiOptions {
            allowed_origins,
            token,
        },
        Box::new(DirAssets::new(&dist)),
    );

    let addr = format!("{bind_host}:{port}");
    let server = match tiny_http::Server::http(&addr) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[campus] cannot listen on {addr}: {e}");
            return ExitCode::from(1);
        }
    };
    println!("Campus\nDist   {dist}\nURL    http://{addr}");

    for mut request in server.incoming_requests() {
        let mut body = Vec::new();
        let _ = request.as_reader().read_to_end(&mut body);
        let req = Request {
            method: request.method().as_str().to_owned(),
            url: request.url().to_owned(),
            headers: request
                .headers()
                .iter()
                .map(|h| {
                    (
                        h.field.as_str().as_str().to_owned(),
                        h.value.as_str().to_owned(),
                    )
                })
                .collect(),
            body,
        };
        let res = campus.respond(&req);
        let mut out = tiny_http::Response::from_data(res.body).with_status_code(res.status);
        for (k, v) in res.headers {
            if let Ok(h) = tiny_http::Header::from_bytes(k.as_bytes(), v.as_bytes()) {
                out.add_header(h);
            }
        }
        let _ = request.respond(out);
    }
    ExitCode::SUCCESS
}
