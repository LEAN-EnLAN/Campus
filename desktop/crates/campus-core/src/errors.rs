//! Stable error codes for everything the Vault can refuse.
//!
//! Port of `src/lib/vault/errors.ts`. The codes cross the HTTP boundary to the
//! React client, which turns them into Spanish (`error-messages.ts`), so they
//! are the contract: same strings, same meaning, append-only.

use std::fmt;
use std::io;

/// Every code the web app knows, in the same order as `VAULT_ERROR_CODES`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    PathEmpty,
    PathAbsolute,
    PathTraversal,
    PathTooLong,
    NameSeparator,
    NameControlChar,
    NameForbiddenChar,
    NameTrailingDotSpace,
    NameReserved,
    OutsideVault,
    TooManyLinks,
    SymlinkUnreadable,
    RootUnreadable,
    NotFound,
    AlreadyExists,
    DestinationExists,
    ConflictChanged,
    ConflictMissing,
    PermissionDenied,
    IoError,
    FolderNotAbsolute,
    FolderNotFound,
    FolderNotDirectory,
    FolderOutsideRoots,
    Unauthorized,
    OriginNotAllowed,
    UnknownVault,
    BadRequest,
    Unavailable,
    Unknown,
}

impl ErrorCode {
    pub const ALL: [ErrorCode; 30] = [
        Self::PathEmpty,
        Self::PathAbsolute,
        Self::PathTraversal,
        Self::PathTooLong,
        Self::NameSeparator,
        Self::NameControlChar,
        Self::NameForbiddenChar,
        Self::NameTrailingDotSpace,
        Self::NameReserved,
        Self::OutsideVault,
        Self::TooManyLinks,
        Self::SymlinkUnreadable,
        Self::RootUnreadable,
        Self::NotFound,
        Self::AlreadyExists,
        Self::DestinationExists,
        Self::ConflictChanged,
        Self::ConflictMissing,
        Self::PermissionDenied,
        Self::IoError,
        Self::FolderNotAbsolute,
        Self::FolderNotFound,
        Self::FolderNotDirectory,
        Self::FolderOutsideRoots,
        Self::Unauthorized,
        Self::OriginNotAllowed,
        Self::UnknownVault,
        Self::BadRequest,
        Self::Unavailable,
        Self::Unknown,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::PathEmpty => "path_empty",
            Self::PathAbsolute => "path_absolute",
            Self::PathTraversal => "path_traversal",
            Self::PathTooLong => "path_too_long",
            Self::NameSeparator => "name_separator",
            Self::NameControlChar => "name_control_char",
            Self::NameForbiddenChar => "name_forbidden_char",
            Self::NameTrailingDotSpace => "name_trailing_dot_space",
            Self::NameReserved => "name_reserved",
            Self::OutsideVault => "outside_vault",
            Self::TooManyLinks => "too_many_links",
            Self::SymlinkUnreadable => "symlink_unreadable",
            Self::RootUnreadable => "root_unreadable",
            Self::NotFound => "not_found",
            Self::AlreadyExists => "already_exists",
            Self::DestinationExists => "destination_exists",
            Self::ConflictChanged => "conflict_changed",
            Self::ConflictMissing => "conflict_missing",
            Self::PermissionDenied => "permission_denied",
            Self::IoError => "io_error",
            Self::FolderNotAbsolute => "folder_not_absolute",
            Self::FolderNotFound => "folder_not_found",
            Self::FolderNotDirectory => "folder_not_directory",
            Self::FolderOutsideRoots => "folder_outside_roots",
            Self::Unauthorized => "unauthorized",
            Self::OriginNotAllowed => "origin_not_allowed",
            Self::UnknownVault => "unknown_vault",
            Self::BadRequest => "bad_request",
            Self::Unavailable => "unavailable",
            Self::Unknown => "unknown",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A refusal with a code. `message` is English for logs and never carries an
/// absolute host path. `conflict` mirrors `VaultConflictError`: the student has
/// two versions of their work and only they decide.
#[derive(Debug, Clone, PartialEq)]
pub struct VaultError {
    pub code: ErrorCode,
    pub message: String,
    /// `Some(detail)` for a `VaultConflictError`; the wire uses the detail.
    pub conflict: Option<String>,
}

impl VaultError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            conflict: None,
        }
    }

    /// `VaultConflictError(path, detail, code)`: message is `path: detail`.
    pub fn conflict(path: &str, detail: &str, code: ErrorCode) -> Self {
        Self {
            code,
            message: format!("{path}: {detail}"),
            conflict: Some(detail.to_owned()),
        }
    }

    pub fn is_conflict(&self) -> bool {
        self.conflict.is_some()
    }
}

impl fmt::Display for VaultError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for VaultError {}

// Windows system error codes that Node maps to a specific errno.
const ERROR_DIRECTORY: i32 = 267; // ENOTDIR
const ERROR_FILENAME_EXCED_RANGE: i32 = 206; // ENAMETOOLONG
const ERROR_CANT_RESOLVE_FILENAME: i32 = 1921; // ELOOP

/// `vaultErrorFromSystem`: whatever the OS said, as a code with NO original
/// text, because OS messages embed absolute host paths.
impl From<io::Error> for VaultError {
    fn from(error: io::Error) -> Self {
        use io::ErrorKind as K;
        let code = match (error.kind(), error.raw_os_error()) {
            (_, Some(ERROR_DIRECTORY)) => ErrorCode::NotFound,
            (_, Some(ERROR_FILENAME_EXCED_RANGE)) => ErrorCode::PathTooLong,
            (_, Some(ERROR_CANT_RESOLVE_FILENAME)) => ErrorCode::TooManyLinks,
            (K::NotFound | K::NotADirectory, _) => ErrorCode::NotFound,
            (K::PermissionDenied | K::ReadOnlyFilesystem, _) => ErrorCode::PermissionDenied,
            (K::InvalidFilename, _) => ErrorCode::PathTooLong,
            (K::AlreadyExists | K::DirectoryNotEmpty, _) => ErrorCode::DestinationExists,
            _ => ErrorCode::IoError,
        };
        system(code)
    }
}

/// The fixed English line `vaultErrorFromSystem` attaches to each code.
pub fn system(code: ErrorCode) -> VaultError {
    let message = match code {
        ErrorCode::NotFound => "not found",
        ErrorCode::PermissionDenied => "permission denied",
        ErrorCode::PathTooLong => "path is too long",
        ErrorCode::TooManyLinks => "too many symbolic links",
        ErrorCode::DestinationExists => "the destination already exists",
        _ => "the operation failed",
    };
    let code = match code {
        ErrorCode::NotFound
        | ErrorCode::PermissionDenied
        | ErrorCode::PathTooLong
        | ErrorCode::TooManyLinks
        | ErrorCode::DestinationExists => code,
        _ => ErrorCode::IoError,
    };
    VaultError::new(code, message)
}

pub type VaultResult<T> = Result<T, VaultError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_match_the_web_contract_in_order() {
        let expected = [
            "path_empty",
            "path_absolute",
            "path_traversal",
            "path_too_long",
            "name_separator",
            "name_control_char",
            "name_forbidden_char",
            "name_trailing_dot_space",
            "name_reserved",
            "outside_vault",
            "too_many_links",
            "symlink_unreadable",
            "root_unreadable",
            "not_found",
            "already_exists",
            "destination_exists",
            "conflict_changed",
            "conflict_missing",
            "permission_denied",
            "io_error",
            "folder_not_absolute",
            "folder_not_found",
            "folder_not_directory",
            "folder_outside_roots",
            "unauthorized",
            "origin_not_allowed",
            "unknown_vault",
            "bad_request",
            "unavailable",
            "unknown",
        ];
        let actual: Vec<_> = ErrorCode::ALL.iter().map(|c| c.as_str()).collect();
        assert_eq!(actual, expected);
    }

    #[test]
    fn system_errors_drop_the_host_path() {
        let raw = io::Error::new(io::ErrorKind::NotFound, "C:\\Users\\secret\\nota.md");
        let mapped = VaultError::from(raw);
        assert_eq!(mapped.code, ErrorCode::NotFound);
        assert_eq!(mapped.message, "not found");
        assert!(!mapped.message.contains("secret"));
    }

    #[test]
    fn system_error_mapping_matches_errno_table() {
        let cases = [
            (
                io::ErrorKind::PermissionDenied,
                "permission_denied",
                "permission denied",
            ),
            (
                io::ErrorKind::AlreadyExists,
                "destination_exists",
                "the destination already exists",
            ),
            (
                io::ErrorKind::DirectoryNotEmpty,
                "destination_exists",
                "the destination already exists",
            ),
            (io::ErrorKind::Other, "io_error", "the operation failed"),
        ];
        for (kind, code, message) in cases {
            let mapped = VaultError::from(io::Error::from(kind));
            assert_eq!(mapped.code.as_str(), code);
            assert_eq!(mapped.message, message);
        }
        let too_long = VaultError::from(io::Error::from_raw_os_error(ERROR_FILENAME_EXCED_RANGE));
        assert_eq!(too_long.code, ErrorCode::PathTooLong);
    }

    #[test]
    fn conflicts_carry_detail_and_path_in_message() {
        let e = VaultError::conflict(
            "a.md",
            "the destination already exists",
            ErrorCode::DestinationExists,
        );
        assert!(e.is_conflict());
        assert_eq!(e.message, "a.md: the destination already exists");
        assert_eq!(
            e.conflict.as_deref(),
            Some("the destination already exists")
        );
    }
}
