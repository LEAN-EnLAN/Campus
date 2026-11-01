//! VAULT-001 — the string half of the path boundary.
//!
//! Port of `src/lib/vault/path-resolver.ts`. Pure: it judges a requested
//! vault-relative path before any I/O. Windows rules apply on every platform so
//! a vault made anywhere opens on Windows.

use crate::errors::{ErrorCode, VaultError};

/// Windows MAX_PATH minus room for the vault root. Measured in UTF-16 code
/// units, exactly like the JS `string.length` it ports.
pub const MAX_RELATIVE_PATH: usize = 200;

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

const FORBIDDEN: [char; 7] = ['<', '>', ':', '"', '|', '?', '*'];

fn reject(reason: &str, code: ErrorCode) -> VaultError {
    VaultError::new(code, reason)
}

fn segment_fault(segment: &str) -> Option<VaultError> {
    if segment.is_empty() {
        return Some(reject("empty segment", ErrorCode::PathEmpty));
    }
    if segment == "." || segment == ".." {
        return Some(reject(
            "path traversal is refused",
            ErrorCode::PathTraversal,
        ));
    }
    if segment.contains('/') || segment.contains('\\') {
        return Some(reject(
            "segment contains a separator",
            ErrorCode::NameSeparator,
        ));
    }
    if segment.chars().any(|c| (c as u32) <= 0x1f || c == '\u{7f}') {
        return Some(reject(
            "name contains a control character",
            ErrorCode::NameControlChar,
        ));
    }
    if segment.contains(FORBIDDEN) {
        return Some(reject(
            "name contains a forbidden character",
            ErrorCode::NameForbiddenChar,
        ));
    }
    if segment.ends_with('.') || segment.ends_with(' ') {
        return Some(reject(
            "name has a trailing dot or space",
            ErrorCode::NameTrailingDotSpace,
        ));
    }
    let stem = segment.split('.').next().unwrap_or("").to_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return Some(reject(
            &format!("\"{stem}\" is a reserved device name"),
            ErrorCode::NameReserved,
        ));
    }
    None
}

/// Is this single path component safe to place inside a vault?
pub fn is_safe_segment(segment: &str) -> bool {
    segment_fault(segment).is_none()
}

fn is_drive_absolute(unified: &str) -> bool {
    let b = unified.as_bytes();
    b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'/'
}

/// Validate a vault-relative path and return its normalised segments.
pub fn validate_vault_path(input: &str) -> Result<Vec<String>, VaultError> {
    if input.is_empty() {
        return Err(reject("empty path", ErrorCode::PathEmpty));
    }
    let unified = input.replace('\\', "/");
    if unified.starts_with('/') || is_drive_absolute(&unified) {
        return Err(reject(
            "absolute paths are not vault-relative",
            ErrorCode::PathAbsolute,
        ));
    }
    if input.encode_utf16().count() > MAX_RELATIVE_PATH {
        return Err(reject(
            "path is too long for the Windows limit",
            ErrorCode::PathTooLong,
        ));
    }

    let raw: Vec<&str> = unified.split('/').collect();
    let mut segments: Vec<String> = Vec::with_capacity(raw.len());
    for (i, seg) in raw.iter().enumerate() {
        if seg.is_empty() && i == raw.len() - 1 && !segments.is_empty() {
            continue;
        }
        if *seg == "." {
            continue;
        }
        if let Some(fault) = segment_fault(seg) {
            return Err(fault);
        }
        segments.push((*seg).to_owned());
    }
    if segments.is_empty() {
        return Err(reject("empty path", ErrorCode::PathEmpty));
    }
    Ok(segments)
}

#[cfg(test)]
mod tests {
    //! Scenarios ported from `src/lib/vault/path-resolver.test.ts`.
    use super::*;

    fn code(input: &str) -> &'static str {
        validate_vault_path(input).unwrap_err().code.as_str()
    }

    #[test]
    fn accepts_ordinary_relative_paths() {
        assert_eq!(
            validate_vault_path("Materias/Analisis I/clase 1.md").unwrap(),
            vec!["Materias", "Analisis I", "clase 1.md"]
        );
        assert_eq!(validate_vault_path("nota.md").unwrap(), vec!["nota.md"]);
    }

    #[test]
    fn tolerates_dot_segments_and_one_trailing_slash() {
        assert_eq!(validate_vault_path("./a/./b").unwrap(), vec!["a", "b"]);
        assert_eq!(validate_vault_path("a/b/").unwrap(), vec!["a", "b"]);
    }

    #[test]
    fn refuses_traversal_in_every_shape() {
        for input in [
            "../etc/passwd",
            "a/../../..",
            "a/..",
            "..\\..\\etc",
            "a\\..\\..\\b",
        ] {
            assert_eq!(code(input), "path_traversal", "{input}");
        }
    }

    #[test]
    fn refuses_absolute_paths() {
        for input in [
            "/etc/passwd",
            "C:\\Windows",
            "c:/x",
            "\\\\server\\share",
            "/",
        ] {
            assert_eq!(code(input), "path_absolute", "{input}");
        }
    }

    #[test]
    fn a_letter_colon_title_is_a_forbidden_char_not_absolute() {
        assert_eq!(code("A: Resumen.md"), "name_forbidden_char");
    }

    #[test]
    fn refuses_empty_and_double_separators() {
        assert_eq!(code(""), "path_empty");
        assert_eq!(code("a//b"), "path_empty");
        assert_eq!(code("."), "path_empty");
    }

    #[test]
    fn refuses_control_and_nul() {
        assert_eq!(code("a\u{0}b.md"), "name_control_char");
        assert_eq!(code("a\nb"), "name_control_char");
        assert_eq!(code("a\u{7f}"), "name_control_char");
    }

    #[test]
    fn refuses_windows_forbidden_chars() {
        for c in ['<', '>', ':', '"', '|', '?', '*'] {
            assert_eq!(code(&format!("a{c}b.md")), "name_forbidden_char");
        }
    }

    #[test]
    fn refuses_trailing_dot_or_space() {
        assert_eq!(code("nota ."), "name_trailing_dot_space");
        assert_eq!(code("dir /x.md"), "name_trailing_dot_space");
    }

    #[test]
    fn refuses_reserved_device_names_with_or_without_extension() {
        for input in ["CON", "con.md", "Lpt1.txt", "a/NUL/b", "COM9"] {
            assert_eq!(code(input), "name_reserved", "{input}");
        }
        assert!(validate_vault_path("CONtabilidad/nota.md").is_ok());
        assert!(validate_vault_path("COM10").is_ok());
    }

    #[test]
    fn reserved_reason_names_the_stem() {
        let e = validate_vault_path("aux.md").unwrap_err();
        assert_eq!(e.message, "\"AUX\" is a reserved device name");
    }

    #[test]
    fn length_is_measured_in_utf16_units() {
        assert!(validate_vault_path(&"a".repeat(200)).is_ok());
        assert_eq!(code(&"a".repeat(201)), "path_too_long");
        // 100 astral chars = 200 UTF-16 units: still inside the limit.
        assert!(validate_vault_path(&"𝔸".repeat(100)).is_ok());
        assert_eq!(code(&"𝔸".repeat(101)), "path_too_long");
    }

    #[test]
    fn safe_segment_matches_the_resolver() {
        assert!(is_safe_segment("Álgebra"));
        assert!(!is_safe_segment(".."));
        assert!(!is_safe_segment("a/b"));
    }
}
