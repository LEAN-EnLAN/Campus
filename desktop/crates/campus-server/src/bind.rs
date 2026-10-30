//! The Vault API may only ever listen on loopback. Port of `src/server/bind-guard.ts`.

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BindVerdict {
    pub safe: bool,
    pub host: String,
    pub reason: &'static str,
}

/// Every address in 127.0.0.0/8, written as four dotted 1–3 digit groups.
fn is_ipv4_loopback(h: &str) -> bool {
    let parts: Vec<&str> = h.split('.').collect();
    parts.len() == 4
        && parts[0] == "127"
        && parts[1..]
            .iter()
            .all(|p| (1..=3).contains(&p.len()) && p.bytes().all(|c| c.is_ascii_digit()))
}

/// `None` is the default bind, which is loopback.
pub fn classify_bind(host: Option<&str>) -> BindVerdict {
    let Some(host) = host else {
        return BindVerdict {
            safe: true,
            host: "localhost".into(),
            reason: "default bind is loopback",
        };
    };
    let n = host.trim().to_ascii_lowercase();
    let verdict = |safe, reason| BindVerdict {
        safe,
        host: host.to_owned(),
        reason,
    };
    if ["localhost", "127.0.0.1", "::1", "[::1]", "0:0:0:0:0:0:0:1"].contains(&n.as_str())
        || is_ipv4_loopback(&n)
    {
        return verdict(true, "loopback address");
    }
    if ["0.0.0.0", "::", "[::]"].contains(&n.as_str()) {
        return verdict(false, "wildcard bind exposes every interface");
    }
    verdict(false, "not a loopback address")
}

#[derive(Debug)]
pub struct UnsafeBindError(pub BindVerdict);

impl fmt::Display for UnsafeBindError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f)?;
        writeln!(f, "Campus refuses to start.")?;
        writeln!(f)?;
        writeln!(
            f,
            "  The Vault API can read and write your files, and the server would bind to \"{}\"",
            self.0.host
        )?;
        writeln!(
            f,
            "  ({}). That would make a filesystem API reachable from your network.",
            self.0.reason
        )?;
        writeln!(f)?;
        writeln!(
            f,
            "  There is no LAN mode. The Origin allowlist and the capability token"
        )?;
        writeln!(
            f,
            "  are defence in depth, not permission to expose the service."
        )?;
        writeln!(f)?;
        writeln!(f, "  Drop --host and use the default loopback bind.")
    }
}

impl std::error::Error for UnsafeBindError {}

pub fn assert_loopback_bind(host: Option<&str>) -> Result<BindVerdict, UnsafeBindError> {
    let v = classify_bind(host);
    if v.safe {
        Ok(v)
    } else {
        Err(UnsafeBindError(v))
    }
}

#[cfg(test)]
mod tests {
    //! Ported from `src/server/bind-guard.test.ts`.
    use super::*;

    #[test]
    fn loopback_is_allowed() {
        assert!(classify_bind(None).safe);
        for h in [
            "127.0.0.1",
            "localhost",
            "::1",
            "[::1]",
            "127.0.0.53",
            "LOCALHOST",
            " 127.0.0.1 ",
        ] {
            assert!(classify_bind(Some(h)).safe, "{h}");
        }
    }

    #[test]
    fn anything_reachable_from_the_network_is_refused() {
        for h in [
            "0.0.0.0",
            "::",
            "[::]",
            "192.168.1.42",
            "10.0.0.5",
            "100.102.107.60",
            "casa.tail61165e.ts.net",
            "0.0.0.0:5173",
            "example.com",
            "localhost.evil.example",
            "notlocalhost",
            "1270.0.0.1",
            "12.7.0.1",
        ] {
            assert!(!classify_bind(Some(h)).safe, "{h}");
        }
    }

    #[test]
    fn the_refusal_is_loud_and_names_the_host_and_reason() {
        let text = assert_loopback_bind(Some("0.0.0.0"))
            .unwrap_err()
            .to_string();
        assert!(text.contains("Campus refuses to start."));
        assert!(text.contains("\"0.0.0.0\""));
        assert!(text.contains("wildcard bind exposes every interface"));
        assert!(assert_loopback_bind(Some("127.0.0.1")).unwrap().safe);
    }
}
