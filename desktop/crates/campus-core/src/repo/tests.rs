//! Scenarios ported from `src/lib/vault/vault-repository.test.ts` and
//! `src/lib/vault/vault-containment.test.ts`, against a real temp directory.

use std::fs as stdfs;
use std::path::Path;

use super::*;
use crate::testlinks::{link_dir, link_dir_relative};

struct Fixture {
    _tmp: tempfile::TempDir,
    vault: PathBuf,
    outside: PathBuf,
    repo: VaultRepository,
}

fn fixture() -> Fixture {
    let tmp = tempfile::tempdir().unwrap();
    let vault = tmp.path().join("vault");
    let outside = tmp.path().join("outside");
    stdfs::create_dir_all(&vault).unwrap();
    stdfs::create_dir_all(&outside).unwrap();
    stdfs::write(outside.join("secret.txt"), "secreto").unwrap();
    let repo = VaultRepository::new(&vault);
    Fixture {
        _tmp: tmp,
        vault,
        outside,
        repo,
    }
}

fn code<T: std::fmt::Debug>(r: VaultResult<T>) -> &'static str {
    r.unwrap_err().code.as_str()
}

fn only_names(dir: &Path) -> Vec<String> {
    let mut v: Vec<_> = stdfs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    v.sort();
    v
}

// ---------------------------------------------------------------- resolve

#[test]
fn accepts_an_ordinary_path_inside_the_vault() {
    let f = fixture();
    let abs = f.repo.resolve("Materias/nota.md").unwrap();
    assert!(abs.starts_with(fs::realpath(&f.vault).unwrap()));
}

#[test]
fn rejects_traversal_before_touching_the_filesystem() {
    let f = fixture();
    for p in ["../outside/secret.txt", "a/../../outside", "..\\..\\x"] {
        assert_eq!(code(f.repo.resolve(p)), "path_traversal", "{p}");
    }
    assert_eq!(
        code(f.repo.resolve("C:\\Windows\\win.ini")),
        "path_absolute"
    );
}

#[test]
fn refuses_a_symlinked_directory_that_points_outside_the_vault() {
    let f = fixture();
    link_dir(&f.outside, &f.vault.join("escape"));
    assert_eq!(code(f.repo.read_note("escape/secret.txt")), "outside_vault");
    assert_eq!(
        code(f.repo.write_note("escape/new.md", "x", None)),
        "outside_vault"
    );
    assert_eq!(code(f.repo.list_dir("escape")), "outside_vault");
    assert_eq!(code(f.repo.stat("escape")), "outside_vault");
    assert_eq!(code(f.repo.mkdir("escape/sub")), "outside_vault");
    assert_eq!(code(f.repo.trash("escape/secret.txt")), "outside_vault");
    assert_eq!(only_names(&f.outside), vec!["secret.txt"]);
}

#[test]
fn rejects_a_rename_target_outside_the_vault() {
    let f = fixture();
    stdfs::write(f.vault.join("a.md"), "a").unwrap();
    link_dir(&f.outside, &f.vault.join("escape"));
    assert_eq!(code(f.repo.rename("a.md", "escape/a.md")), "outside_vault");
    assert_eq!(
        code(f.repo.rename("escape/secret.txt", "b.md")),
        "outside_vault"
    );
    assert!(f.vault.join("a.md").exists());
    assert_eq!(only_names(&f.outside), vec!["secret.txt"]);
}

// ------------------------------------------------------------- writeNote

#[test]
fn writes_and_reads_back() {
    let f = fixture();
    f.repo.write_note("nota.md", "# Hola", None).unwrap();
    let loaded = f.repo.read_note("nota.md").unwrap();
    assert_eq!(loaded.contents, "# Hola");
    assert!(loaded.mtime_ms > 0.0);
}

#[test]
fn leaves_no_temporary_files_behind() {
    let f = fixture();
    f.repo.write_note("nota.md", "uno", None).unwrap();
    let m = f.repo.read_note("nota.md").unwrap().mtime_ms;
    f.repo.write_note("nota.md", "dos", Some(m)).unwrap();
    assert_eq!(only_names(&f.vault), vec!["nota.md"]);
}

#[test]
fn creates_missing_parent_folders_inside_the_vault() {
    let f = fixture();
    f.repo.write_note("a/b/c.md", "x", None).unwrap();
    assert_eq!(
        stdfs::read_to_string(f.vault.join("a/b/c.md")).unwrap(),
        "x"
    );
}

#[test]
fn refuses_to_overwrite_a_file_that_changed_on_disk() {
    let f = fixture();
    f.repo.write_note("nota.md", "v1", None).unwrap();
    let loaded = f.repo.read_note("nota.md").unwrap();
    let e = f
        .repo
        .write_note("nota.md", "mine", Some(loaded.mtime_ms - 1000.0))
        .unwrap_err();
    assert_eq!(e.code, ErrorCode::ConflictChanged);
    assert!(e.is_conflict());
    assert_eq!(
        stdfs::read_to_string(f.vault.join("nota.md")).unwrap(),
        "v1"
    );
}

#[test]
fn accepts_the_write_when_unchanged_since_loaded() {
    let f = fixture();
    f.repo.write_note("nota.md", "v1", None).unwrap();
    let m = f.repo.read_note("nota.md").unwrap().mtime_ms;
    f.repo.write_note("nota.md", "v2", Some(m)).unwrap();
    assert_eq!(f.repo.read_note("nota.md").unwrap().contents, "v2");
}

#[test]
fn refuses_to_create_a_file_that_appeared_meanwhile() {
    let f = fixture();
    stdfs::write(f.vault.join("nota.md"), "external").unwrap();
    let e = f.repo.write_note("nota.md", "mine", None).unwrap_err();
    assert_eq!(e.code, ErrorCode::AlreadyExists);
    assert_eq!(
        e.conflict.as_deref(),
        Some("expected a new file, but one already exists on disk")
    );
    assert_eq!(
        stdfs::read_to_string(f.vault.join("nota.md")).unwrap(),
        "external"
    );
}

#[test]
fn a_deleted_file_is_conflict_missing() {
    let f = fixture();
    let e = f.repo.write_note("gone.md", "x", Some(1.0)).unwrap_err();
    assert_eq!(e.code, ErrorCode::ConflictMissing);
}

#[test]
fn re_stats_rather_than_trusting_the_mtime_it_was_handed() {
    let f = fixture();
    f.repo.write_note("nota.md", "v1", None).unwrap();
    let m = f.repo.read_note("nota.md").unwrap().mtime_ms;
    std::thread::sleep(std::time::Duration::from_millis(20));
    stdfs::write(f.vault.join("nota.md"), "external edit").unwrap();
    assert_eq!(
        f.repo
            .write_note("nota.md", "mine", Some(m))
            .unwrap_err()
            .code,
        ErrorCode::ConflictChanged
    );
}

#[test]
fn reading_a_directory_is_an_io_error_like_node_eisdir() {
    let f = fixture();
    stdfs::create_dir(f.vault.join("dir")).unwrap();
    assert_eq!(code(f.repo.read_note("dir")), "io_error");
    assert_eq!(code(f.repo.read_note("missing.md")), "not_found");
}

// ---------------------------------------------------------------- rename

#[test]
fn rename_refuses_when_the_destination_exists() {
    let f = fixture();
    stdfs::write(f.vault.join("a.md"), "a").unwrap();
    stdfs::write(f.vault.join("b.md"), "b").unwrap();
    let e = f.repo.rename("a.md", "b.md").unwrap_err();
    assert_eq!(e.code, ErrorCode::DestinationExists);
    assert!(e.is_conflict());
    assert_eq!(stdfs::read_to_string(f.vault.join("b.md")).unwrap(), "b");
    assert_eq!(stdfs::read_to_string(f.vault.join("a.md")).unwrap(), "a");
}

#[test]
fn rename_onto_a_free_name_creating_parents() {
    let f = fixture();
    stdfs::write(f.vault.join("a.md"), "a").unwrap();
    f.repo.rename("a.md", "dir/c.md").unwrap();
    assert!(!f.vault.join("a.md").exists());
    assert_eq!(
        stdfs::read_to_string(f.vault.join("dir/c.md")).unwrap(),
        "a"
    );
    assert_eq!(code(f.repo.rename("missing.md", "x.md")), "not_found");
}

// --------------------------------------------------------------- listDir

#[test]
fn list_dir_returns_kinds_sorted_dirs_first_hiding_dot_campus_at_root() {
    let f = fixture();
    stdfs::create_dir_all(f.vault.join(".campus/academic")).unwrap();
    stdfs::create_dir(f.vault.join("Zeta")).unwrap();
    stdfs::create_dir(f.vault.join("álgebra")).unwrap();
    stdfs::write(f.vault.join("b.md"), "bb").unwrap();
    stdfs::write(f.vault.join("A.md"), "a").unwrap();
    let entries = f.repo.list_dir("").unwrap();
    let names: Vec<_> = entries
        .iter()
        .map(|e| (e.name.as_str(), e.kind.as_str()))
        .collect();
    assert_eq!(
        names,
        vec![
            ("álgebra", "dir"),
            ("Zeta", "dir"),
            ("A.md", "file"),
            ("b.md", "file")
        ]
    );
    assert_eq!(entries[3].size, 2);
    // `.campus` is hidden only at the root, and only by name.
    assert_eq!(f.repo.list_dir(".campus").unwrap()[0].name, "academic");
}

#[test]
fn list_dir_of_missing_or_file_is_not_found() {
    let f = fixture();
    stdfs::write(f.vault.join("a.md"), "a").unwrap();
    assert_eq!(code(f.repo.list_dir("missing")), "not_found");
    assert_eq!(code(f.repo.list_dir("a.md")), "not_found");
}

// ----------------------------------------------------------------- trash

#[test]
fn trash_moves_into_dot_campus_trash_with_a_sidecar() {
    let f = fixture();
    f.repo
        .write_note("Materias/nota.md", "contenido", None)
        .unwrap();
    let t = f.repo.trash("Materias/nota.md").unwrap();
    assert!(t.trashed_to.starts_with(".campus/trash/"));
    assert!(t.trashed_to.ends_with("-nota.md"));
    assert!(!f.vault.join("Materias/nota.md").exists());
    assert_eq!(
        stdfs::read_to_string(f.vault.join(&t.trashed_to)).unwrap(),
        "contenido"
    );
    let meta = stdfs::read_to_string(f.vault.join(format!("{}.meta.json", t.trashed_to))).unwrap();
    let v: serde_json::Value = serde_json::from_str(&meta).unwrap();
    assert_eq!(v["originalPath"], "Materias/nota.md");
    assert!(v["trashedAt"].as_str().unwrap().ends_with('Z'));
    assert!(meta.starts_with("{\n  \"originalPath\""));
    assert!(meta.ends_with("}\n"));
}

#[test]
fn two_trashed_files_with_the_same_name_do_not_clobber() {
    let f = fixture();
    f.repo.write_note("a/nota.md", "uno", None).unwrap();
    f.repo.write_note("b/nota.md", "dos", None).unwrap();
    let one = f.repo.trash("a/nota.md").unwrap();
    let two = f.repo.trash("b/nota.md").unwrap();
    assert_ne!(one.trashed_to, two.trashed_to);
    assert_eq!(
        stdfs::read_to_string(f.vault.join(&one.trashed_to)).unwrap(),
        "uno"
    );
    assert_eq!(
        stdfs::read_to_string(f.vault.join(&two.trashed_to)).unwrap(),
        "dos"
    );
}

#[test]
fn trash_outside_the_vault_is_refused() {
    let f = fixture();
    assert_eq!(
        code(f.repo.trash("../outside/secret.txt")),
        "path_traversal"
    );
    assert_eq!(code(f.repo.trash("missing.md")), "not_found");
}

#[test]
fn long_names_are_shortened_in_the_trash_keeping_the_extension() {
    let long = format!("{}.md", "a".repeat(150));
    let short = short_trash_name(&long);
    assert_eq!(short.chars().count(), 80);
    assert!(short.ends_with(".md"));
    assert_eq!(short_trash_name("corto.md"), "corto.md");
    let dotted = format!("{}. .{}", "b".repeat(76), "x".repeat(20));
    assert!(!short_trash_name(&dotted).ends_with(['.', ' ']));
}

// ------------------------------------------------------------------ stat

#[test]
fn stat_answers_kind_and_mtime_or_none() {
    let f = fixture();
    f.repo.write_note("n.md", "abc", None).unwrap();
    let s = f.repo.stat("n.md").unwrap().unwrap();
    assert_eq!((s.kind, s.size), (EntryKind::File, 3));
    assert_eq!(f.repo.stat("missing.md").unwrap(), None);
    f.repo.mkdir("d").unwrap();
    assert_eq!(f.repo.stat("d").unwrap().unwrap().kind, EntryKind::Dir);
}

// ------------------------------------------------------------ containment

#[test]
fn two_hop_directory_links_are_refused_everywhere() {
    let f = fixture();
    // hop2 -> outside, hop1 -> hop2 (both absolute junction-or-symlink).
    link_dir(&f.outside, &f.vault.join("hop2"));
    link_dir(&f.vault.join("hop2"), &f.vault.join("hop1"));
    assert_eq!(code(f.repo.list_dir("hop1")), "outside_vault");
    assert_eq!(code(f.repo.read_note("hop1/secret.txt")), "outside_vault");
    assert_eq!(
        code(f.repo.write_note("hop1/new.md", "x", None)),
        "outside_vault"
    );
    assert_eq!(
        code(f.repo.write_note("hop1/nuevo/new.md", "x", None)),
        "outside_vault"
    );
    assert_eq!(code(f.repo.mkdir("hop1/sub")), "outside_vault");
    stdfs::write(f.vault.join("in.md"), "x").unwrap();
    assert_eq!(code(f.repo.rename("in.md", "hop1/in.md")), "outside_vault");
    assert_eq!(
        code(f.repo.rename("hop1/secret.txt", "x.md")),
        "outside_vault"
    );
    assert_eq!(code(f.repo.trash("hop1/secret.txt")), "outside_vault");
    assert_eq!(only_names(&f.outside), vec!["secret.txt"]);
}

#[test]
fn a_relative_link_that_climbs_out_is_refused() {
    let f = fixture();
    if !link_dir_relative(Path::new("../outside"), &f.vault.join("up")) {
        eprintln!(
            "skipped: relative symlinks need Developer Mode or SeCreateSymbolicLinkPrivilege"
        );
        return;
    }
    assert_eq!(code(f.repo.read_note("up/secret.txt")), "outside_vault");
    assert_eq!(
        code(f.repo.write_note("up/x.md", "x", None)),
        "outside_vault"
    );
}

#[test]
fn chained_links_that_stay_inside_remain_allowed() {
    let f = fixture();
    stdfs::create_dir_all(f.vault.join("real/dir")).unwrap();
    link_dir(&f.vault.join("real"), &f.vault.join("l2"));
    link_dir(&f.vault.join("l2"), &f.vault.join("l1"));
    f.repo.write_note("l1/dir/new.md", "ok", None).unwrap();
    assert_eq!(
        stdfs::read_to_string(f.vault.join("real/dir/new.md")).unwrap(),
        "ok"
    );
}

#[test]
fn iso_and_base36_match_javascript() {
    assert_eq!(iso_from_ms(0), "1970-01-01T00:00:00.000Z");
    assert_eq!(iso_from_ms(1_730_301_234_567), "2024-10-30T15:13:54.567Z");
    assert_eq!(iso_from_ms(951_782_400_000), "2000-02-29T00:00:00.000Z");
    assert_eq!(to_base36(0), "0");
    assert_eq!(to_base36(1_730_301_234_567), "m2w0ohaf");
}
