//! VAULT-001/002/003 — the vault repository, the single path authority.
//!
//! Port of `src/lib/vault/vault-repository.ts`. `paths` judges the string;
//! this judges where the path really lands once the filesystem has had its say,
//! walking components the way the kernel does and following every link.

use std::path::{MAIN_SEPARATOR_STR, Path, PathBuf};

use crate::collate::compare_es;
use crate::errors::{ErrorCode, VaultError, VaultResult};
use crate::fs::{self, EntryKind};
use crate::paths::validate_vault_path;

/// Linux caps symlink expansion at 40 per lookup (ELOOP); the walk uses the same bound.
const MAX_LINK_HOPS: u32 = 40;
const TRASH_NAME_MAX: usize = 80;

#[derive(Debug, Clone, PartialEq)]
pub struct LoadedNote {
    pub contents: String,
    pub mtime_ms: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VaultEntry {
    pub name: String,
    pub kind: EntryKind,
    pub mtime_ms: f64,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VaultStat {
    pub kind: EntryKind,
    pub mtime_ms: f64,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrashedEntry {
    pub trashed_to: String,
}

/// A file name safe to carry into the trash: at most 80 code points, keeping a
/// short extension, never ending in a dot or space.
pub fn short_trash_name(name: &str) -> String {
    let chars: Vec<char> = name.chars().collect();
    if chars.len() <= TRASH_NAME_MAX {
        return name.to_owned();
    }
    let utf16_len = name.encode_utf16().count();
    let extension = match name.rfind('.') {
        Some(dot) if dot > 0 => {
            let dot_utf16 = name[..dot].encode_utf16().count();
            if utf16_len - dot_utf16 <= 12 {
                &name[dot..]
            } else {
                ""
            }
        }
        _ => "",
    };
    let keep = TRASH_NAME_MAX - extension.chars().count();
    let stem: String = chars[..keep].iter().collect();
    format!("{}{extension}", stem.trim_end_matches(['.', ' ']))
}

/// `Number.prototype.toString(36)` for a non-negative integer.
pub fn to_base36(mut n: u128) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".into();
    }
    let mut out = Vec::new();
    while n > 0 {
        out.push(DIGITS[(n % 36) as usize]);
        n /= 36;
    }
    out.reverse();
    String::from_utf8(out).expect("ascii")
}

/// `new Date().toISOString()`: `YYYY-MM-DDTHH:MM:SS.mmmZ`, UTC.
pub fn iso_now() -> String {
    iso_from_ms(fs::now_ms() as i64)
}

pub fn iso_from_ms(ms: i64) -> String {
    let days = ms.div_euclid(86_400_000);
    let rem = ms.rem_euclid(86_400_000);
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{:03}Z",
        rem / 3_600_000,
        rem / 60_000 % 60,
        rem / 1000 % 60,
        rem % 1000
    )
}

fn path_str(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

fn dirname(p: &Path) -> PathBuf {
    p.parent()
        .map_or_else(|| p.to_path_buf(), Path::to_path_buf)
}

pub struct VaultRepository {
    root: PathBuf,
}

impl VaultRepository {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Where does this vault-relative path really land?
    pub fn resolve(&self, relative: &str) -> VaultResult<PathBuf> {
        let segments = validate_vault_path(relative)?;
        let real_root = fs::realpath(&self.root).map_err(|_| {
            VaultError::new(ErrorCode::RootUnreadable, "vault root is not readable")
        })?;
        let root_s = path_str(&real_root);
        let inside = |p: &Path| {
            let s = path_str(p);
            s == root_s
                || s.starts_with(&format!("{root_s}/"))
                || s.starts_with(&format!("{root_s}\\"))
        };
        let outside =
            || VaultError::new(ErrorCode::OutsideVault, "path resolves outside the vault");

        let mut current = real_root.clone();
        let mut pending: std::collections::VecDeque<String> = segments.into();
        let mut deepest_existing = real_root.clone();
        let mut hops = 0;
        let mut absent = false;

        while let Some(segment) = pending.pop_front() {
            if segment.is_empty() || segment == "." {
                continue;
            }
            if segment == ".." {
                current = dirname(&current);
                continue;
            }
            let candidate = current.join(&segment);
            let stat = if absent { None } else { fs::lstat(&candidate)? };
            let Some(stat) = stat else {
                absent = true;
                current = candidate;
                continue;
            };
            if stat.kind != EntryKind::Symlink {
                current = candidate.clone();
                deepest_existing = candidate;
                continue;
            }

            hops += 1;
            if hops > MAX_LINK_HOPS {
                return Err(VaultError::new(
                    ErrorCode::TooManyLinks,
                    "too many symbolic links",
                ));
            }
            let target = fs::readlink(&candidate).map_err(|_| {
                VaultError::new(ErrorCode::SymlinkUnreadable, "symlink is not readable")
            })?;
            let unified = target.replace('\\', "/");
            if unified.starts_with("//") {
                return Err(outside());
            }
            let b = unified.as_bytes();
            let has_drive = b.len() >= 2 && b[0].is_ascii_alphabetic() && b[1] == b':';
            if unified.starts_with('/') {
                current = PathBuf::from(MAIN_SEPARATOR_STR);
            } else if has_drive {
                current = PathBuf::from(format!("{}{MAIN_SEPARATOR_STR}", &unified[..2]));
            }
            let body = if has_drive {
                &unified[2..]
            } else {
                &unified[..]
            };
            let parts: Vec<String> = body
                .trim_start_matches('/')
                .split('/')
                .map(str::to_owned)
                .collect();
            for part in parts.into_iter().rev() {
                pending.push_front(part);
            }
            deepest_existing = current.clone();
        }

        if !inside(&current) {
            return Err(outside());
        }
        match fs::realpath(&deepest_existing) {
            Ok(real) if inside(&real) => Ok(current),
            _ => Err(outside()),
        }
    }

    pub fn read_note(&self, relative: &str) -> VaultResult<LoadedNote> {
        let absolute = self.resolve(relative)?;
        let stat = fs::lstat(&absolute)?
            .ok_or_else(|| VaultError::new(ErrorCode::NotFound, "not found"))?;
        // Node answers EISDIR (io_error) for a directory; Windows would say
        // "access denied", which is the wrong story.
        if stat.kind == EntryKind::Dir {
            return Err(crate::errors::system(ErrorCode::IoError));
        }
        let contents = fs::read_file(&absolute)?;
        Ok(LoadedNote {
            contents,
            mtime_ms: stat.mtime_ms,
        })
    }

    /// `expected_mtime_ms`: `None` = "I believe this file does not exist".
    pub fn write_note(
        &self,
        relative: &str,
        contents: &str,
        expected_mtime_ms: Option<f64>,
    ) -> VaultResult<()> {
        let absolute = self.resolve(relative)?;
        let current = fs::lstat(&absolute)?;
        match (expected_mtime_ms, current) {
            (None, Some(_)) => {
                return Err(VaultError::conflict(
                    relative,
                    "expected a new file, but one already exists on disk",
                    ErrorCode::AlreadyExists,
                ));
            }
            (Some(_), None) => {
                return Err(VaultError::conflict(
                    relative,
                    "the file was deleted or moved after it was loaded",
                    ErrorCode::ConflictMissing,
                ));
            }
            (Some(expected), Some(stat)) if stat.mtime_ms != expected => {
                return Err(VaultError::conflict(
                    relative,
                    "the file changed on disk after it was loaded",
                    ErrorCode::ConflictChanged,
                ));
            }
            _ => {}
        }
        fs::mkdirp(&dirname(&absolute))?;
        fs::write_file_atomic(&absolute, contents)?;
        Ok(())
    }

    /// Refuses an existing destination: POSIX rename overwrites silently, and
    /// "renaming a.md onto b.md deleted my b.md" is data loss.
    pub fn rename(&self, from: &str, to: &str) -> VaultResult<()> {
        let source = self.resolve(from)?;
        let destination = self.resolve(to)?;
        if fs::lstat(&source)?.is_none() {
            return Err(VaultError::new(ErrorCode::NotFound, "not found"));
        }
        if fs::lstat(&destination)?.is_some() {
            return Err(VaultError::conflict(
                to,
                "the destination already exists",
                ErrorCode::DestinationExists,
            ));
        }
        fs::mkdirp(&dirname(&destination))?;
        fs::rename(&source, &destination)?;
        Ok(())
    }

    pub fn list_dir(&self, relative: &str) -> VaultResult<Vec<VaultEntry>> {
        let absolute = if relative.is_empty() {
            fs::realpath(&self.root)?
        } else {
            self.resolve(relative)?
        };
        if fs::lstat(&absolute)?.is_none() {
            return Err(VaultError::new(ErrorCode::NotFound, "not found"));
        }
        let mut out = Vec::new();
        for entry in fs::readdir(&absolute)? {
            if relative.is_empty() && entry.name == ".campus" {
                continue;
            }
            if entry.kind != EntryKind::File && entry.kind != EntryKind::Dir {
                continue;
            }
            let Some(stat) = fs::lstat(&absolute.join(&entry.name))? else {
                continue;
            };
            out.push(VaultEntry {
                name: entry.name,
                kind: entry.kind,
                mtime_ms: stat.mtime_ms,
                size: stat.size,
            });
        }
        out.sort_by(|a, b| match (a.kind == b.kind, a.kind) {
            (true, _) => compare_es(&a.name, &b.name),
            (false, EntryKind::Dir) => std::cmp::Ordering::Less,
            (false, _) => std::cmp::Ordering::Greater,
        });
        Ok(out)
    }

    pub fn mkdir(&self, relative: &str) -> VaultResult<()> {
        let absolute = self.resolve(relative)?;
        fs::mkdirp(&absolute)?;
        Ok(())
    }

    /// Delete is trash-not-unlink: content moves to `.campus/trash/` with a
    /// `.meta.json` sidecar naming where it came from.
    pub fn trash(&self, relative: &str) -> VaultResult<TrashedEntry> {
        let source = self.resolve(relative)?;
        if fs::lstat(&source)?.is_none() {
            return Err(VaultError::new(ErrorCode::NotFound, "not found"));
        }
        let last = relative
            .split(['/', '\\'])
            .rfind(|s| !s.is_empty())
            .unwrap_or(relative);
        let name = short_trash_name(last);
        let unique = format!("{}-{}", to_base36(fs::now_ms()), fs::random_base36(4));
        let trashed_to = format!(".campus/trash/{unique}-{name}");

        let destination = self.resolve(&trashed_to)?;
        let meta = self.resolve(&format!("{trashed_to}.meta.json"))?;
        fs::mkdirp(&dirname(&destination))?;
        fs::rename(&source, &destination)?;

        let mut sidecar = serde_json::Map::new();
        sidecar.insert("originalPath".into(), relative.into());
        sidecar.insert("trashedAt".into(), iso_now().into());
        let body = serde_json::to_string_pretty(&sidecar).expect("json") + "\n";
        fs::write_file_atomic(&meta, &body)?;
        Ok(TrashedEntry { trashed_to })
    }

    pub fn stat(&self, relative: &str) -> VaultResult<Option<VaultStat>> {
        let absolute = self.resolve(relative)?;
        Ok(fs::lstat(&absolute)?.and_then(|s| match s.kind {
            EntryKind::File | EntryKind::Dir => Some(VaultStat {
                kind: s.kind,
                mtime_ms: s.mtime_ms,
                size: s.size,
            }),
            _ => None,
        }))
    }
}

#[cfg(test)]
mod tests;
