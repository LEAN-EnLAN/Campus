//! Campus core: the vault, ported 1:1 from the web app's privileged side.
//!
//! | Module     | Ports                                   |
//! |------------|-----------------------------------------|
//! | `errors`   | `src/lib/vault/errors.ts`               |
//! | `paths`    | `src/lib/vault/path-resolver.ts`        |
//! | `fs`       | `src/lib/vault/node-fs.ts`              |
//! | `repo`     | `src/lib/vault/vault-repository.ts`     |
//! | `sessions` | `VaultSessions` + `src/server/vault-roots.ts` |
//! | `collate`  | `String.prototype.localeCompare(_, 'es')` |

pub mod collate;
pub mod errors;
pub mod fs;
pub mod paths;
pub mod repo;
pub mod sessions;

#[cfg(test)]
pub(crate) mod testlinks;

pub use errors::{ErrorCode, VaultError, VaultResult};
pub use repo::VaultRepository;
pub use sessions::VaultSessions;
