//! Directory links for tests. A real symlink when the OS allows it (Developer
//! Mode or the privilege), otherwise a junction — which Windows, Node and Rust
//! all report as a link, so it exercises the same walk.

use std::path::Path;

#[cfg(windows)]
pub fn link_dir(target: &Path, link: &Path) {
    if std::os::windows::fs::symlink_dir(target, link).is_err() {
        junction::create(target, link).expect("create junction");
    }
}

#[cfg(not(windows))]
pub fn link_dir(target: &Path, link: &Path) {
    std::os::unix::fs::symlink(target, link).expect("create symlink");
}

/// A relative directory symlink; `false` when the OS refuses (no junction
/// fallback exists, junctions are always absolute).
pub fn link_dir_relative(target: &Path, link: &Path) -> bool {
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(target, link).is_ok()
    }
    #[cfg(not(windows))]
    {
        std::os::unix::fs::symlink(target, link).is_ok()
    }
}
