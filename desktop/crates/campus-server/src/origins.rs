//! Which browser origins the Vault API answers. Port of `src/server/vault-origins.ts`.

pub const ALLOWED_ORIGINS_ENV: &str = "CAMPUS_VAULT_ALLOWED_ORIGINS";

const LOOPBACK_HOSTS: [&str; 3] = ["localhost", "127.0.0.1", "[::1]"];

pub fn loopback_origins(scheme: &str, port: u16) -> Vec<String> {
    LOOPBACK_HOSTS
        .iter()
        .map(|h| format!("{scheme}://{h}:{port}"))
        .collect()
}

/// A bare origin (`scheme://host[:port]`) normalised like WHATWG `url.origin`:
/// lower-case host, default port dropped. Anything else is `None`.
fn parse_origin(candidate: &str) -> Option<String> {
    let (scheme, rest) = candidate.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();
    let default_port = match scheme.as_str() {
        "http" => 80,
        "https" => 443,
        _ => return None,
    };
    if rest.is_empty() || rest.contains(['/', '?', '#', '@', ' ']) {
        return None;
    }
    let (host, port) = match rest.strip_prefix('[').and_then(|r| r.find(']')) {
        Some(end) => (&rest[..end + 2], rest[end + 2..].strip_prefix(':')),
        None => match rest.rsplit_once(':') {
            Some((h, p)) => (h, Some(p)),
            None => (rest, None),
        },
    };
    if host.is_empty() {
        return None;
    }
    let host = host.to_ascii_lowercase();
    match port {
        None | Some("") => Some(format!("{scheme}://{host}")),
        Some(p) if p.bytes().all(|c| c.is_ascii_digit()) => {
            let p: u16 = p.parse().ok()?;
            if p == default_port {
                Some(format!("{scheme}://{host}"))
            } else {
                Some(format!("{scheme}://{host}:{p}"))
            }
        }
        Some(_) => None,
    }
}

/// `extraAllowedOrigins`: strict on purpose; a value that can never equal an
/// `Origin` header is dropped.
pub fn extra_allowed_origins(raw: Option<&str>) -> Vec<String> {
    let Some(raw) = raw else { return vec![] };
    raw.split(',')
        .filter_map(|entry| {
            let candidate = entry.trim().trim_end_matches('/');
            if candidate.is_empty() || candidate.contains('*') {
                return None;
            }
            parse_origin(candidate)
        })
        .collect()
}

pub fn vault_allowed_origins(scheme: &str, port: u16, extra: Option<&str>) -> Vec<String> {
    let mut list = loopback_origins(scheme, port);
    list.extend(extra_allowed_origins(extra));
    list
}

#[cfg(test)]
mod tests {
    //! Ported from `src/server/vault-origins.test.ts`.
    use super::*;

    #[test]
    fn default_is_exactly_the_three_loopback_names() {
        assert_eq!(
            vault_allowed_origins("http", 5173, None),
            vec![
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://[::1]:5173"
            ]
        );
    }

    #[test]
    fn appends_opted_in_origins_after_loopback() {
        let list = vault_allowed_origins("http", 5173, Some("https://casa.tail61165e.ts.net"));
        assert_eq!(list.len(), 4);
        assert_eq!(list[3], "https://casa.tail61165e.ts.net");
    }

    #[test]
    fn accepts_a_trimmed_comma_list_and_drops_trailing_slash() {
        assert_eq!(
            extra_allowed_origins(Some(
                " https://casa.tail61165e.ts.net , https://iphone.tail61165e.ts.net "
            )),
            vec![
                "https://casa.tail61165e.ts.net",
                "https://iphone.tail61165e.ts.net"
            ]
        );
        assert_eq!(
            extra_allowed_origins(Some("https://casa.tail61165e.ts.net/")),
            vec!["https://casa.tail61165e.ts.net"]
        );
    }

    #[test]
    fn refuses_anything_that_is_not_a_full_origin() {
        for junk in [
            "casa.tail61165e.ts.net",
            "https://casa.tail61165e.ts.net/vault",
            "https://casa.tail61165e.ts.net?x=1",
            "ftp://casa.tail61165e.ts.net",
            "*",
            "https://",
            "https://*.ts.net",
        ] {
            assert!(extra_allowed_origins(Some(junk)).is_empty(), "{junk}");
        }
    }

    #[test]
    fn normalises_like_url_origin() {
        assert_eq!(
            extra_allowed_origins(Some("HTTPS://Casa.TS.net:443")),
            vec!["https://casa.ts.net"]
        );
        assert_eq!(
            extra_allowed_origins(Some("http://h:8080")),
            vec!["http://h:8080"]
        );
    }

    #[test]
    fn empty_for_unset_or_blank() {
        assert!(extra_allowed_origins(None).is_empty());
        assert!(extra_allowed_origins(Some("")).is_empty());
        assert!(extra_allowed_origins(Some("  ,  , ")).is_empty());
    }
}
