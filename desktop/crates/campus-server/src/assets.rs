//! Static frontend, academic catalog and the token-injected `index.html`.
//!
//! In development Vite does three things for LOCAL mode beyond the Vault API:
//! serves the built app, serves `public/academic-catalog/` with an honest JSON
//! 404 (`src/server/vite-catalog-plugin.ts`), and prepends
//! `window.__CAMPUS_VAULT_TOKEN__=…` to `index.html`
//! (`src/server/vite-vault-plugin.ts`). This module does the same for the
//! desktop, over any `AssetSource` (a `dist/` folder, or Tauri's embedded assets).

use std::borrow::Cow;
use std::path::{Path, PathBuf};

use crate::api::{Request, Response};

pub const CATALOG_PREFIX: &str = "/academic-catalog";

pub trait AssetSource: Send + Sync {
    /// `relative` is already decoded and judged safe: no `..`, no `\`, no NUL.
    fn get(&self, relative: &str) -> Option<Cow<'_, [u8]>>;
}

/// A built `dist/` directory on disk.
pub struct DirAssets {
    root: PathBuf,
}

impl DirAssets {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
}

impl AssetSource for DirAssets {
    fn get(&self, relative: &str) -> Option<Cow<'_, [u8]>> {
        let target = self.root.join(relative);
        if !target.starts_with(&self.root) || !target.is_file() {
            return None;
        }
        std::fs::read(target).ok().map(Cow::Owned)
    }
}

fn percent_decode(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            let hex = s.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// The asset a URL path names, decoded, or `None` if it names nothing we will
/// serve. Same refusals as `resolveCatalogAsset`, applied to every asset.
pub fn safe_relative(url_path: &str) -> Option<String> {
    let path = url_path.split('?').next()?;
    let relative = percent_decode(path.strip_prefix('/')?)?;
    if relative.is_empty()
        || relative.ends_with('/')
        || relative.contains('\\')
        || relative.contains('\0')
        || relative
            .split('/')
            .any(|seg| seg.is_empty() || seg.starts_with(".."))
    {
        return None;
    }
    Some(relative)
}

/// `resolveCatalogAsset` (pure part): the catalog-relative file or `None`.
pub fn resolve_catalog_asset(url_path: &str, root: &Path) -> Option<PathBuf> {
    let path = url_path.split('?').next()?;
    let rest = path.strip_prefix(CATALOG_PREFIX)?.strip_prefix('/')?;
    let relative = safe_relative(&format!("/{rest}"))?;
    let target = root.join(&relative);
    target.starts_with(root).then_some(target)
}

pub fn mime_for(name: &str) -> &'static str {
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "webmanifest" => "application/manifest+json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "txt" => "text/plain; charset=utf-8",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

/// Prepend the per-process capability to `<head>`, as Vite's
/// `transformIndexHtml` (`injectTo: 'head-prepend'`) does.
pub fn inject_token(html: &str, token: &str) -> String {
    let script = format!(
        "<script>window.__CAMPUS_VAULT_TOKEN__={}</script>",
        serde_json::to_string(token).expect("json")
    );
    match html
        .find("<head")
        .and_then(|i| html[i..].find('>').map(|j| i + j + 1))
    {
        Some(at) => format!("{}{script}{}", &html[..at], &html[at..]),
        None => format!("{script}{html}"),
    }
}

fn plain(status: u16, content_type: &str, cache: &str, body: Vec<u8>) -> Response {
    Response {
        status,
        headers: vec![
            ("content-type".into(), content_type.into()),
            ("cache-control".into(), cache.into()),
            ("x-content-type-options".into(), "nosniff".into()),
        ],
        body,
    }
}

fn catalog_not_found() -> Response {
    plain(
        404,
        "application/json; charset=utf-8",
        "no-cache",
        br#"{"error":"catalog asset not found"}"#.to_vec(),
    )
}

/// Serve one non-API request.
pub fn serve(req: &Request, source: &dyn AssetSource, token: &str) -> Response {
    if req.method != "GET" && req.method != "HEAD" {
        return plain(
            405,
            "text/plain; charset=utf-8",
            "no-store",
            b"method not allowed".to_vec(),
        );
    }
    let path = req.path();

    if path == CATALOG_PREFIX || path.starts_with(&format!("{CATALOG_PREFIX}/")) {
        // Never falls through to the SPA: a catalog miss is an honest JSON 404,
        // not index.html at 200 (the failure the Vite plugin exists to prevent).
        return match safe_relative(path).and_then(|rel| source.get(&rel).map(|b| b.into_owned())) {
            Some(body) => plain(200, "application/json; charset=utf-8", "no-cache", body),
            None => catalog_not_found(),
        };
    }

    if let Some(relative) = safe_relative(path)
        && relative != "index.html"
        && let Some(body) = source.get(&relative)
    {
        let cache = if relative.starts_with("assets/") {
            "public, max-age=31536000, immutable"
        } else {
            "no-cache"
        };
        return plain(200, mime_for(&relative), cache, body.into_owned());
    }

    // A missing file with an extension is a 404; anything else is a route of
    // the single-page app and gets index.html.
    let last = path.rsplit('/').next().unwrap_or("");
    if last.contains('.') && last != "index.html" {
        return plain(
            404,
            "text/plain; charset=utf-8",
            "no-store",
            b"not found".to_vec(),
        );
    }
    match source.get("index.html") {
        Some(html) => plain(
            200,
            "text/html; charset=utf-8",
            "no-store",
            inject_token(&String::from_utf8_lossy(&html), token).into_bytes(),
        ),
        None => plain(
            500,
            "text/plain; charset=utf-8",
            "no-store",
            b"frontend build missing (index.html)".to_vec(),
        ),
    }
}

#[cfg(test)]
mod tests {
    //! `resolveCatalogAsset` scenarios ported from `src/server/catalog-assets.test.ts`.
    use super::*;

    fn root() -> PathBuf {
        std::env::temp_dir().join("catalog")
    }

    #[test]
    fn resolves_files_ignoring_query_and_decoding() {
        let r = root();
        assert_eq!(
            resolve_catalog_asset("/academic-catalog/institutions.json", &r),
            Some(r.join("institutions.json"))
        );
        assert_eq!(
            resolve_catalog_asset("/academic-catalog/curricula/utn-2023.json", &r),
            Some(r.join("curricula/utn-2023.json"))
        );
        assert_eq!(
            resolve_catalog_asset("/academic-catalog/institutions.json?v=2", &r),
            Some(r.join("institutions.json"))
        );
        assert_eq!(
            resolve_catalog_asset("/academic-catalog/an%C3%A1lisis.json", &r),
            Some(r.join("análisis.json"))
        );
    }

    #[test]
    fn refuses_every_escape_shape() {
        let r = root();
        for url in [
            "/academic-catalog/../../etc/passwd",
            "/academic-catalog/..%2F..%2Fetc%2Fpasswd",
            "/academic-catalog/..%252F..%252Fetc",
            "/academic-catalog/curricula/../../../etc/passwd",
            "/academic-catalog/..\\..\\windows\\win.ini",
            "/academic-catalog/institutions.json\0.png",
            "/academic-catalog//etc/passwd",
            "/academic-catalog/",
            "/academic-catalog",
            "/src/main.tsx",
            "/academic-catalogue/x.json",
            "/academic-catalogX/x.json",
            "/academic-catalog/%E0%A4%A.json",
        ] {
            assert_eq!(resolve_catalog_asset(url, &r), None, "{url}");
        }
    }

    #[test]
    fn token_is_prepended_inside_head() {
        let html = "<!doctype html><html><head><meta charset=\"UTF-8\" /></head></html>";
        let out = inject_token(html, "abc");
        assert!(out.starts_with(
            "<!doctype html><html><head><script>window.__CAMPUS_VAULT_TOKEN__=\"abc\"</script><meta"
        ));
    }

    struct Mem;
    impl AssetSource for Mem {
        fn get(&self, relative: &str) -> Option<Cow<'_, [u8]>> {
            match relative {
                "index.html" => Some(Cow::Borrowed(b"<html><head></head></html>")),
                "assets/app.js" => Some(Cow::Borrowed(b"x")),
                "academic-catalog/institutions.json" => Some(Cow::Borrowed(b"[]")),
                _ => None,
            }
        }
    }

    fn get(url: &str) -> Response {
        serve(
            &Request {
                method: "GET".into(),
                url: url.into(),
                headers: vec![],
                body: vec![],
            },
            &Mem,
            "tok",
        )
    }

    #[test]
    fn serves_spa_assets_and_catalog_like_vite() {
        let index = get("/today");
        assert_eq!(index.status, 200);
        assert!(String::from_utf8_lossy(&index.body).contains("__CAMPUS_VAULT_TOKEN__=\"tok\""));
        assert_eq!(index.header("cache-control"), Some("no-store"));
        assert_eq!(get("/").status, 200);
        assert_eq!(get("/index.html").status, 200);

        let js = get("/assets/app.js");
        assert_eq!(
            js.header("content-type"),
            Some("text/javascript; charset=utf-8")
        );

        let cat = get("/academic-catalog/institutions.json");
        assert_eq!((cat.status, cat.body.as_slice()), (200, b"[]".as_slice()));
        let miss = get("/academic-catalog/missing.json");
        assert_eq!(miss.status, 404);
        assert_eq!(miss.body, br#"{"error":"catalog asset not found"}"#);
        assert_eq!(get("/missing.png").status, 404);
    }
}
