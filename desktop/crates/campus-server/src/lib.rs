//! Campus server: the transport around `campus-core`.
//!
//! | Module    | Ports                                         |
//! |-----------|-----------------------------------------------|
//! | `api`     | `src/server/vault-api.ts` (`handleVaultRequest`) |
//! | `origins` | `src/server/vault-origins.ts`                 |
//! | `bind`    | `src/server/bind-guard.ts`                    |
//! | `assets`  | `vite-catalog-plugin.ts`, `catalog-assets.ts`, the token injection in `vite-vault-plugin.ts`, and Vite's static/SPA serving |
//!
//! `Campus::respond` is the whole app behind one function, so the Tauri custom
//! protocol and the loopback HTTP binary mount exactly the same code.

pub mod api;
pub mod assets;
pub mod bind;
pub mod origins;

use std::path::PathBuf;

use campus_core::VaultSessions;
use campus_core::sessions::{ALLOWED_ROOTS_ENV, home_dir, parse_allowed_roots};

pub use api::{ApiOptions, PREFIX, Request, Response};
pub use assets::{AssetSource, DirAssets};

pub struct Campus {
    pub sessions: VaultSessions,
    pub options: ApiOptions,
    pub assets: Box<dyn AssetSource>,
}

impl Campus {
    /// Allowed roots from `CAMPUS_VAULT_ALLOWED_ROOTS`, else the user's home.
    /// Rejected entries are returned so the caller can report them loudly.
    pub fn roots_from_env() -> (Vec<PathBuf>, Vec<String>) {
        let raw = std::env::var(ALLOWED_ROOTS_ENV).ok();
        let parsed = parse_allowed_roots(raw.as_deref(), &home_dir());
        (parsed.roots, parsed.rejected)
    }

    pub fn new(roots: Vec<PathBuf>, options: ApiOptions, assets: Box<dyn AssetSource>) -> Self {
        Self {
            sessions: VaultSessions::new(roots),
            options,
            assets,
        }
    }

    pub fn respond(&self, req: &Request) -> Response {
        if req.url.starts_with(PREFIX) {
            api::handle(req, &self.sessions, &self.options)
        } else {
            assets::serve(req, self.assets.as_ref(), &self.options.token)
        }
    }
}
