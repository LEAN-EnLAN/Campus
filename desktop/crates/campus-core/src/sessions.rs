//! Choosing a vault: allowed roots and open sessions by opaque id.
//!
//! Port of `src/server/vault-roots.ts` and the `VaultSessions` class in
//! `src/server/vault-api.ts`. The page names an absolute path exactly once, at
//! `open`, confined to the allowed roots, and gets back a random id.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, RwLock};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

use crate::collate::compare_es;
use crate::errors::{ErrorCode, VaultError, VaultResult};
use crate::fs::{self, EntryKind};
use crate::repo::VaultRepository;

pub const ALLOWED_ROOTS_ENV: &str = "CAMPUS_VAULT_ALLOWED_ROOTS";

#[cfg(windows)]
const DELIMITER: char = ';';
#[cfg(not(windows))]
const DELIMITER: char = ':';

/// Node's `path.isAbsolute` for the host platform.
pub fn is_absolute(path: &str) -> bool {
    if cfg!(windows) {
        let b = path.as_bytes();
        path.starts_with(['/', '\\'])
            || (b.len() >= 3
                && b[0].is_ascii_alphabetic()
                && b[1] == b':'
                && (b[2] == b'/' || b[2] == b'\\'))
    } else {
        path.starts_with('/')
    }
}

/// Node's `path.resolve` for an absolute input: normalised, no trailing separator.
pub fn resolve(path: &str) -> PathBuf {
    let absolute = std::path::absolute(path).unwrap_or_else(|_| PathBuf::from(path));
    let mut out = PathBuf::new();
    for c in absolute.components() {
        match c {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn components_lower(p: &Path) -> Vec<String> {
    p.components()
        .filter(|c| !matches!(c, Component::CurDir))
        .map(|c| {
            let s = c.as_os_str().to_string_lossy().replace('/', "\\");
            if cfg!(windows) { s.to_lowercase() } else { s }
        })
        .collect()
}

/// Is `candidate` one of the roots, or inside one? Whole segments only, and
/// case-insensitive on Windows like `path.win32.relative`.
pub fn is_inside_any<P: AsRef<Path>>(roots: &[P], candidate: &Path) -> bool {
    let target = components_lower(&resolve(&candidate.to_string_lossy()));
    roots.iter().any(|root| {
        let root = components_lower(&resolve(&root.as_ref().to_string_lossy()));
        target.len() >= root.len() && target[..root.len()] == root[..]
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedRoots {
    pub roots: Vec<PathBuf>,
    pub rejected: Vec<String>,
}

/// `parseAllowedRoots`: strict, fail-closed, never re-adds the default.
pub fn parse_allowed_roots(raw: Option<&str>, home: &Path) -> ParsedRoots {
    let Some(raw) = raw.filter(|r| !r.trim().is_empty()) else {
        return ParsedRoots {
            roots: vec![resolve(&home.to_string_lossy())],
            rejected: vec![],
        };
    };
    let mut roots: Vec<PathBuf> = Vec::new();
    let mut rejected = Vec::new();
    for entry in raw.split(DELIMITER) {
        let candidate = entry.trim();
        if candidate.is_empty() {
            continue;
        }
        if candidate.contains('\0') || candidate.contains('*') || !is_absolute(candidate) {
            rejected.push(candidate.to_owned());
            continue;
        }
        let normalised = resolve(candidate);
        if normalised.parent().is_none() {
            rejected.push(candidate.to_owned());
            continue;
        }
        if !roots.contains(&normalised) {
            roots.push(normalised);
        }
    }
    ParsedRoots { roots, rejected }
}

pub fn home_dir() -> PathBuf {
    std::env::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

/// A fresh capability or id: `randomBytes(n).toString('base64url')`.
pub fn random_token(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    getrandom::fill(&mut buf).expect("OS random source");
    URL_SAFE_NO_PAD.encode(buf)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenedVault {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderListing {
    pub path: String,
    pub parent: Option<String>,
    pub dirs: Vec<String>,
}

pub struct VaultSessions {
    by_id: RwLock<HashMap<String, Arc<VaultRepository>>>,
    allowed_roots: Vec<PathBuf>,
}

fn folder_error(e: VaultError) -> VaultError {
    if e.code == ErrorCode::NotFound {
        VaultError::new(ErrorCode::FolderNotFound, e.message)
    } else {
        e
    }
}

impl VaultSessions {
    pub fn new(allowed_roots: Vec<PathBuf>) -> Self {
        Self {
            by_id: RwLock::new(HashMap::new()),
            allowed_roots: allowed_roots
                .iter()
                .map(|r| resolve(&r.to_string_lossy()))
                .collect(),
        }
    }

    pub fn allowed_roots(&self) -> &[PathBuf] {
        &self.allowed_roots
    }

    fn real_roots(&self) -> Vec<PathBuf> {
        self.allowed_roots
            .iter()
            .filter_map(|r| fs::realpath(r).ok())
            .collect()
    }

    /// Judged twice: on the string (no existence oracle outside the roots),
    /// then on the real path (a link inside the home pointing out is refused).
    fn admit(&self, path: &str) -> VaultResult<PathBuf> {
        if !is_absolute(path) {
            return Err(VaultError::new(
                ErrorCode::FolderNotAbsolute,
                "path is not absolute",
            ));
        }
        let outside = || {
            VaultError::new(
                ErrorCode::FolderOutsideRoots,
                "folder is outside the allowed roots",
            )
        };
        let real_roots = self.real_roots();
        let mut textual = self.allowed_roots.clone();
        textual.extend(real_roots.iter().cloned());
        if !is_inside_any(&textual, Path::new(path)) {
            return Err(outside());
        }

        let real = (|| -> VaultResult<PathBuf> {
            if fs::lstat(Path::new(path))?.is_none() {
                return Err(VaultError::new(
                    ErrorCode::FolderNotFound,
                    "vault not found",
                ));
            }
            Ok(fs::realpath(Path::new(path))?)
        })()
        .map_err(folder_error)?;

        if !is_inside_any(&real_roots, &real) {
            return Err(outside());
        }
        match fs::lstat(&real)? {
            None => Err(VaultError::new(
                ErrorCode::FolderNotFound,
                "vault not found",
            )),
            Some(s) if s.kind != EntryKind::Dir => Err(VaultError::new(
                ErrorCode::FolderNotDirectory,
                "not a directory",
            )),
            Some(_) => Ok(real),
        }
    }

    /// Make ONE missing level inside a parent that `admit` accepts.
    fn ensure_folder(&self, path: &str) -> VaultResult<()> {
        if !is_absolute(path) {
            return Err(VaultError::new(
                ErrorCode::FolderNotAbsolute,
                "path is not absolute",
            ));
        }
        let target = resolve(path);
        let Some(parent) = target.parent() else {
            return Ok(());
        };
        if fs::lstat(&target)?.is_some() {
            return Ok(());
        }
        let real_parent = self.admit(&parent.to_string_lossy())?;
        let name = target.file_name().unwrap_or_default();
        fs::mkdirp(&real_parent.join(name))?;
        Ok(())
    }

    pub fn open(&self, path: &str, create: bool) -> VaultResult<OpenedVault> {
        if create {
            self.ensure_folder(path)?;
        }
        let real = self.admit(path)?;
        let id = random_token(16);
        let real_s = real.to_string_lossy().into_owned();
        let name = real_s
            .rsplit(['/', '\\'])
            .next()
            .map(str::to_owned)
            .unwrap_or(real_s.clone());
        self.by_id
            .write()
            .expect("sessions lock")
            .insert(id.clone(), Arc::new(VaultRepository::new(real)));
        Ok(OpenedVault { id, name })
    }

    pub fn get(&self, id: &str) -> Option<Arc<VaultRepository>> {
        self.by_id.read().expect("sessions lock").get(id).cloned()
    }

    pub fn exists(&self, path: &str) -> bool {
        self.admit(path).is_ok()
    }

    pub fn list_dirs(&self, path: Option<&str>) -> VaultResult<FolderListing> {
        let first = self
            .allowed_roots
            .first()
            .map(|r| r.to_string_lossy().into_owned());
        let start = match path {
            None | Some("") => first.ok_or_else(|| {
                VaultError::new(
                    ErrorCode::FolderOutsideRoots,
                    "folder is outside the allowed roots",
                )
            })?,
            Some(p) => p.to_owned(),
        };
        let real = self.admit(&start)?;
        let real_roots = self.real_roots();
        let entries = fs::readdir(&real)?;

        let mut dirs = Vec::new();
        for entry in entries {
            if entry.name.starts_with('.') {
                continue;
            }
            match entry.kind {
                EntryKind::Dir => dirs.push(entry.name),
                EntryKind::Symlink => {
                    let Ok(target) = fs::realpath(&real.join(&entry.name)) else {
                        continue;
                    };
                    if let Ok(Some(s)) = fs::lstat(&target)
                        && s.kind == EntryKind::Dir
                        && is_inside_any(&real_roots, &target)
                    {
                        dirs.push(entry.name);
                    }
                }
                _ => {}
            }
        }
        dirs.sort_by(|a, b| compare_es(a, b));

        let up = real.parent().map(Path::to_path_buf);
        let parent = up
            .filter(|u| *u != real && is_inside_any(&real_roots, u))
            .map(|u| u.to_string_lossy().into_owned());
        Ok(FolderListing {
            path: real.to_string_lossy().into_owned(),
            parent,
            dirs,
        })
    }
}

#[cfg(test)]
mod tests {
    //! Scenarios ported from `src/server/vault-roots.test.ts`.
    use super::*;

    #[test]
    fn default_is_home_only() {
        let home = std::env::temp_dir();
        let parsed = parse_allowed_roots(None, &home);
        assert_eq!(parsed.roots, vec![resolve(&home.to_string_lossy())]);
        assert!(parsed.rejected.is_empty());
        assert_eq!(parse_allowed_roots(Some("   "), &home).roots.len(), 1);
    }

    #[test]
    fn explicit_list_replaces_default_and_reports_rejects() {
        let home = std::env::temp_dir();
        let (a, b) = if cfg!(windows) {
            (r"C:\Campus\uno", r"D:\dos")
        } else {
            ("/srv/uno", "/srv/dos")
        };
        let root = if cfg!(windows) { r"C:\" } else { "/" };
        let raw = [a, "relativo", "~/x", "*", root, b, a].join(&DELIMITER.to_string());
        let parsed = parse_allowed_roots(Some(&raw), &home);
        assert_eq!(parsed.roots, vec![PathBuf::from(a), PathBuf::from(b)]);
        assert_eq!(parsed.rejected, vec!["relativo", "~/x", "*", root]);
    }

    #[test]
    fn a_list_that_parses_to_nothing_allows_nothing() {
        let parsed = parse_allowed_roots(Some("relativo"), &std::env::temp_dir());
        assert!(parsed.roots.is_empty());
    }

    #[test]
    fn inside_compares_whole_segments() {
        let root = std::env::temp_dir().join("campus-root");
        assert!(is_inside_any(&[&root], &root));
        assert!(is_inside_any(&[&root], &root.join("a").join("b")));
        let sibling = PathBuf::from(format!("{}x", root.to_string_lossy()));
        assert!(!is_inside_any(&[&root], &sibling));
        assert!(!is_inside_any(&[&root], &root.join("..").join("other")));
    }

    #[cfg(windows)]
    #[test]
    fn inside_is_case_insensitive_on_windows() {
        assert!(is_inside_any(
            &[Path::new(r"C:\Users\Ana")],
            Path::new(r"c:\users\ana\Vault")
        ));
        assert!(!is_inside_any(
            &[Path::new(r"C:\Users\Ana")],
            Path::new(r"D:\Users\Ana")
        ));
    }

    #[test]
    fn node_absolute_semantics() {
        assert!(!is_absolute("relativo/x"));
        if cfg!(windows) {
            assert!(is_absolute(r"C:\x"));
            assert!(is_absolute("c:/x"));
            assert!(is_absolute(r"\x"));
            assert!(!is_absolute("C:x"));
        }
    }

    #[test]
    fn tokens_are_base64url_without_padding() {
        let t = random_token(32);
        assert_eq!(t.len(), 43);
        assert!(
            t.chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        );
        assert_eq!(random_token(16).len(), 22);
    }
}
