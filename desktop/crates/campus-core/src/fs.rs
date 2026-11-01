//! Mechanical plumbing over `std::fs`, port of `src/lib/vault/node-fs.ts`.
//!
//! Every security decision lives in `paths` and `repo`, never here. The only
//! job of this module is to answer exactly what Node's `fs` would have
//! answered, so a vault behaves the same under either server.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryKind {
    File,
    Dir,
    Symlink,
    Other,
}

impl EntryKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Dir => "dir",
            Self::Symlink => "symlink",
            Self::Other => "other",
        }
    }

    fn of(t: fs::FileType) -> Self {
        if t.is_symlink() {
            Self::Symlink
        } else if t.is_dir() {
            Self::Dir
        } else if t.is_file() {
            Self::File
        } else {
            Self::Other
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FileStat {
    pub kind: EntryKind,
    pub size: u64,
    pub mtime_ms: f64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DirEntry {
    pub name: String,
    pub kind: EntryKind,
}

/// Node's `mtimeMs`: `sec * 1e3 + nsec / 1e6`, in the same f64 operations, so
/// the value a client got from Node and the value Rust computes are the same
/// double and the conflict check compares equal.
pub fn mtime_ms(time: SystemTime) -> f64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(d) => d.as_secs() as f64 * 1e3 + f64::from(d.subsec_nanos()) / 1e6,
        Err(e) => {
            let d = e.duration();
            -(d.as_secs() as f64 * 1e3 + f64::from(d.subsec_nanos()) / 1e6)
        }
    }
}

/// `lstat`: `None` only for absence. Any other failure propagates, because
/// reporting "permission denied" as "not there" would let the repository create
/// a file over something it could not read.
pub fn lstat(path: &Path) -> io::Result<Option<FileStat>> {
    match fs::symlink_metadata(path) {
        Ok(m) => Ok(Some(FileStat {
            kind: EntryKind::of(m.file_type()),
            size: if m.is_dir() { 0 } else { m.len() },
            mtime_ms: mtime_ms(m.modified()?),
        })),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Strip the Win32 namespace prefixes Rust keeps and Node drops.
fn strip_verbatim(path: PathBuf) -> PathBuf {
    let s = path.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    if let Some(rest) = s.strip_prefix(r"\\?\").or_else(|| s.strip_prefix(r"\??\")) {
        return PathBuf::from(rest);
    }
    path
}

pub fn realpath(path: &Path) -> io::Result<PathBuf> {
    fs::canonicalize(path).map(|p| strip_verbatim(dunce::simplified(&p).to_path_buf()))
}

pub fn readlink(path: &Path) -> io::Result<String> {
    fs::read_link(path).map(|p| strip_verbatim(p).to_string_lossy().into_owned())
}

/// `readFile(path, 'utf8')`: invalid UTF-8 becomes U+FFFD, a BOM is kept.
pub fn read_file(path: &Path) -> io::Result<String> {
    let bytes = fs::read(path)?;
    Ok(match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(e) => String::from_utf8_lossy(e.as_bytes()).into_owned(),
    })
}

fn random_suffix(len: usize) -> String {
    const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut bytes = vec![0u8; len];
    getrandom::fill(&mut bytes).expect("OS random source");
    bytes
        .iter()
        .map(|b| ALPHABET[usize::from(*b) % ALPHABET.len()] as char)
        .collect()
}

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Write to a temp file in the same directory, fsync, rename over the target.
/// A crash mid-write leaves the old note or the new one, never half of one.
pub fn write_file_atomic(path: &Path, contents: &str) -> io::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    let tmp = dir.join(format!(
        ".campus-tmp-{}-{}-{}",
        std::process::id(),
        now_ms(),
        random_suffix(6)
    ));
    {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp)?;
        let written = file
            .write_all(contents.as_bytes())
            .and_then(|_| file.sync_all());
        if let Err(e) = written {
            drop(file);
            let _ = fs::remove_file(&tmp);
            return Err(e);
        }
    }
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

pub fn mkdirp(path: &Path) -> io::Result<()> {
    fs::create_dir_all(path)
}

pub fn readdir(path: &Path) -> io::Result<Vec<DirEntry>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        out.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            kind: EntryKind::of(entry.file_type()?),
        });
    }
    Ok(out)
}

pub fn rename(from: &Path, to: &Path) -> io::Result<()> {
    fs::rename(from, to)
}

pub(crate) fn random_base36(len: usize) -> String {
    random_suffix(len)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn mtime_ms_matches_node_arithmetic() {
        let t = UNIX_EPOCH + Duration::new(1_730_301_234, 567_123_400);
        assert_eq!(mtime_ms(t), 1_730_301_234_f64 * 1e3 + 567_123_400_f64 / 1e6);
    }

    #[test]
    fn atomic_write_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("nota.md");
        write_file_atomic(&target, "hola").unwrap();
        write_file_atomic(&target, "chau").unwrap();
        assert_eq!(read_file(&target).unwrap(), "chau");
        let names: Vec<_> = readdir(dir.path())
            .unwrap()
            .into_iter()
            .map(|e| e.name)
            .collect();
        assert_eq!(names, vec!["nota.md"]);
    }

    #[test]
    fn lstat_is_none_only_for_absence() {
        let dir = tempfile::tempdir().unwrap();
        assert!(lstat(&dir.path().join("missing")).unwrap().is_none());
        let s = lstat(dir.path()).unwrap().unwrap();
        assert_eq!(s.kind, EntryKind::Dir);
        assert_eq!(s.size, 0);
    }

    #[test]
    fn invalid_utf8_reads_lossy_like_node() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("x.md");
        fs::write(&p, b"a\xffb").unwrap();
        assert_eq!(read_file(&p).unwrap(), "a\u{fffd}b");
    }

    #[test]
    fn realpath_has_no_verbatim_prefix() {
        let dir = tempfile::tempdir().unwrap();
        let real = realpath(dir.path()).unwrap();
        assert!(!real.to_string_lossy().starts_with(r"\\?\"));
    }
}
