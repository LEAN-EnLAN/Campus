//! Campus for Windows.
//!
//! ```text
//!   WebView2 ── campus://localhost/… ──► Campus::respond
//!                                         ├─ /__campus/vault/*  → campus_server::api → campus_core
//!                                         └─ everything else    → embedded dist/ (+ token in index.html)
//! ```
//!
//! The page is the same React build the dev server serves; it cannot tell it
//! is in a desktop shell. There is no TCP listener and no Tauri capability:
//! the page's only door to the disk is the Vault API, confined to the allowed
//! roots (the user's home unless `CAMPUS_VAULT_ALLOWED_ROOTS` says otherwise).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::borrow::Cow;
use std::sync::{Arc, OnceLock};
use std::time::Instant;

use campus_server::{ApiOptions, AssetSource, Campus, Request, api};
use tauri::http::{Response as HttpResponse, header::HeaderName, header::HeaderValue};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

const SCHEME: &str = "campus";

/// The origin WebView2 gives a custom protocol on Windows; `campus://localhost`
/// elsewhere. Stable across launches, so `localStorage` persists.
const ORIGINS: [&str; 2] = ["http://campus.localhost", "campus://localhost"];

static CAMPUS: OnceLock<Arc<Campus>> = OnceLock::new();

/// The frontend Tauri embedded at build time from `build.frontendDist`.
struct EmbeddedAssets(AppHandle);

impl AssetSource for EmbeddedAssets {
    fn get(&self, relative: &str) -> Option<Cow<'_, [u8]>> {
        self.0
            .asset_resolver()
            .get(relative.to_owned())
            .map(|asset| Cow::Owned(asset.bytes))
    }
}

fn to_request(request: &tauri::http::Request<Vec<u8>>) -> Request {
    let uri = request.uri();
    Request {
        method: request.method().as_str().to_owned(),
        url: uri
            .path_and_query()
            .map_or_else(|| uri.path().to_owned(), |pq| pq.as_str().to_owned()),
        headers: request
            .headers()
            .iter()
            .filter_map(|(k, v)| Some((k.as_str().to_owned(), v.to_str().ok()?.to_owned())))
            .collect(),
        body: request.body().clone(),
    }
}

fn to_response(res: campus_server::Response) -> HttpResponse<Vec<u8>> {
    let mut out = HttpResponse::new(res.body);
    *out.status_mut() = tauri::http::StatusCode::from_u16(res.status)
        .unwrap_or(tauri::http::StatusCode::INTERNAL_SERVER_ERROR);
    for (k, v) in res.headers {
        if let (Ok(k), Ok(v)) = (HeaderName::try_from(k), HeaderValue::try_from(v)) {
            out.headers_mut().insert(k, v);
        }
    }
    out
}

/// `CAMPUS_STARTUP_TRACE=<file>` appends `event ms-since-process-start` lines,
/// so startup can be measured on a release build that has no console.
fn trace(event: &str, started: Instant) {
    let Some(path) = std::env::var_os("CAMPUS_STARTUP_TRACE") else {
        return;
    };
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(f, "{event} {}", started.elapsed().as_millis());
    }
}

fn main() {
    let started = Instant::now();
    let (roots, rejected) = Campus::roots_from_env();
    for entry in &rejected {
        eprintln!("[campus] CAMPUS_VAULT_ALLOWED_ROOTS: ignored \"{entry}\"");
    }

    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol(SCHEME, |_ctx, request, responder| {
            let Some(campus) = CAMPUS.get().cloned() else {
                responder.respond(
                    HttpResponse::builder()
                        .status(503)
                        .body(b"starting".to_vec())
                        .expect("static response"),
                );
                return;
            };
            // Disk work off the WebView thread.
            std::thread::spawn(move || {
                let response = campus.respond(&to_request(&request));
                responder.respond(to_response(response));
            });
        })
        .setup(move |app| {
            let campus = Campus::new(
                roots,
                ApiOptions {
                    allowed_origins: ORIGINS.iter().map(|o| (*o).to_owned()).collect(),
                    token: api::mint_token(),
                },
                Box::new(EmbeddedAssets(app.handle().clone())),
            );
            let _ = CAMPUS.set(Arc::new(campus));

            let url: tauri::Url = format!("{SCHEME}://localhost/").parse()?;
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::CustomProtocol(url))
                .title("Campus")
                .inner_size(1280.0, 820.0)
                .min_inner_size(390.0, 600.0)
                .center()
                .visible(true)
                .build()?;
            let _ = window;
            trace("window_created", started);
            Ok(())
        })
        .on_page_load(move |_webview, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                trace("page_load_finished", started);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Campus");
}
