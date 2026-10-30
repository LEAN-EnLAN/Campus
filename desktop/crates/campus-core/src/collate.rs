//! `a.localeCompare(b, 'es')`, which the web side uses to order the explorer
//! and the folder browser.
//!
//! V8 delegates to ICU (CLDR root order + the Spanish `ñ` tailoring, tertiary
//! strength). This is a compact reimplementation of the part a file or folder
//! name exercises, in three passes like ICU:
//!
//! 1. primary   — whitespace < punctuation (CLDR order) < symbols < digits <
//!    letters; letters by base letter, `ñ` its own letter after `n`
//! 2. secondary — unaccented before accented
//! 3. tertiary  — lower case before upper case
//!
//! A pure-Rust ICU (`icu_collator`) was the first choice; its build script is
//! blocked by Windows Smart App Control on the build machine (os error 4551),
//! so the table lives here and the tests pin it against Node's own output.

use std::cmp::Ordering;

/// CLDR root order for ASCII punctuation and symbols, before digits.
const PUNCTUATION: &str = "_-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";

#[derive(Clone, Copy)]
struct Weights {
    primary: u32,
    secondary: u8,
    tertiary: u8,
}

/// Base letter and accent flag for the Latin letters a Spanish-speaking
/// student types; `None` means "not one of them".
fn fold_latin(c: char) -> Option<(char, u8)> {
    let (base, accent) = match c {
        'á' | 'Á' => ('a', 1),
        'à' | 'À' => ('a', 2),
        'â' | 'Â' => ('a', 3),
        'ä' | 'Ä' => ('a', 4),
        'ã' | 'Ã' => ('a', 5),
        'å' | 'Å' => ('a', 6),
        'é' | 'É' => ('e', 1),
        'è' | 'È' => ('e', 2),
        'ê' | 'Ê' => ('e', 3),
        'ë' | 'Ë' => ('e', 4),
        'í' | 'Í' => ('i', 1),
        'ì' | 'Ì' => ('i', 2),
        'î' | 'Î' => ('i', 3),
        'ï' | 'Ï' => ('i', 4),
        'ó' | 'Ó' => ('o', 1),
        'ò' | 'Ò' => ('o', 2),
        'ô' | 'Ô' => ('o', 3),
        'ö' | 'Ö' => ('o', 4),
        'õ' | 'Õ' => ('o', 5),
        'ú' | 'Ú' => ('u', 1),
        'ù' | 'Ù' => ('u', 2),
        'û' | 'Û' => ('u', 3),
        'ü' | 'Ü' => ('u', 4),
        'ç' | 'Ç' => ('c', 7),
        'ý' | 'Ý' => ('y', 1),
        'ÿ' => ('y', 4),
        _ if c.is_ascii_alphabetic() => (c.to_ascii_lowercase(), 0),
        _ => return None,
    };
    Some((base, accent))
}

fn weights(c: char) -> Weights {
    let tertiary = u8::from(c.is_uppercase());
    if c.is_whitespace() {
        return Weights {
            primary: 0x100 + c as u32,
            secondary: 0,
            tertiary: 0,
        };
    }
    if let Some(i) = PUNCTUATION.find(c) {
        return Weights {
            primary: 0x1000 + i as u32,
            secondary: 0,
            tertiary: 0,
        };
    }
    if let Some(d) = c.to_digit(10) {
        return Weights {
            primary: 0x2000 + d,
            secondary: 0,
            tertiary: 0,
        };
    }
    if c == 'ñ' || c == 'Ñ' {
        // Spanish tailoring: a letter of its own, right after `n`.
        return Weights {
            primary: 0x3000 + ('n' as u32 - 'a' as u32) * 2 + 1,
            secondary: 0,
            tertiary,
        };
    }
    if let Some((base, accent)) = fold_latin(c) {
        return Weights {
            primary: 0x3000 + (base as u32 - 'a' as u32) * 2,
            secondary: accent,
            tertiary,
        };
    }
    if c.is_alphabetic() {
        // Other scripts: after Latin, by lower-case code point.
        let lower = c.to_lowercase().next().unwrap_or(c);
        return Weights {
            primary: 0x10000 + lower as u32,
            secondary: 0,
            tertiary,
        };
    }
    // Remaining symbols: after the table, before digits.
    Weights {
        primary: 0x1800 + (c as u32 & 0x7ff),
        secondary: 0,
        tertiary: 0,
    }
}

pub fn compare_es(a: &str, b: &str) -> Ordering {
    let wa: Vec<Weights> = a.chars().map(weights).collect();
    let wb: Vec<Weights> = b.chars().map(weights).collect();
    let by = |f: fn(&Weights) -> u32| wa.iter().map(f).cmp(wb.iter().map(f));
    by(|w| w.primary)
        .then_with(|| by(|w| u32::from(w.secondary)))
        .then_with(|| by(|w| u32::from(w.tertiary)))
        .then_with(|| a.cmp(b))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(words: &[&str]) -> Vec<String> {
        let mut v: Vec<String> = words.iter().map(|s| (*s).to_owned()).collect();
        v.sort_by(|a, b| compare_es(a, b));
        v
    }

    #[test]
    fn matches_v8_locale_compare_es_on_single_letters() {
        // Node 24: [...].sort((a, b) => a.localeCompare(b, 'es'))
        assert_eq!(
            sorted(&[
                "b", "a", "Á", "á", "ñ", "n", "o", "_x", "1", "Z", "z", "é", "e"
            ]),
            [
                "_x", "1", "a", "á", "Á", "b", "e", "é", "n", "ñ", "o", "z", "Z"
            ]
        );
    }

    #[test]
    fn matches_v8_locale_compare_es_on_file_names() {
        let input = [
            "nota.md",
            "Nota.md",
            "nóta.md",
            "notas.md",
            "ñandú",
            "nandu",
            "Ñandú",
            "zeta",
            "Zeta",
            "_borrador",
            "-guion",
            "(par)",
            "[cor]",
            "10 clase",
            "2 clase",
            "1-clase",
            "1_clase",
            "1 clase",
            "a b",
            "a-b",
            "a_b",
            "ab",
            "a.b",
            "Álgebra",
            "algebra",
            "ALGEBRA",
            "álgebra",
            "Análisis Matemático I",
            "Analisis",
            "über",
            "uber",
            "Uber",
            "çedilla",
            "cedilla",
            "~tilde",
            "$dolar",
            "#hash",
            "@at",
            "!bang",
            ".oculto",
            "'quote",
            "año",
            "ano",
            "anos",
            "Año 2",
        ];
        // Verbatim output of Node 24 for the same list.
        let expected = [
            "_borrador",
            "-guion",
            "!bang",
            ".oculto",
            "'quote",
            "(par)",
            "[cor]",
            "@at",
            "#hash",
            "~tilde",
            "$dolar",
            "1 clase",
            "1_clase",
            "1-clase",
            "10 clase",
            "2 clase",
            "a b",
            "a_b",
            "a-b",
            "a.b",
            "ab",
            "algebra",
            "ALGEBRA",
            "álgebra",
            "Álgebra",
            "Analisis",
            "Análisis Matemático I",
            "ano",
            "anos",
            "año",
            "Año 2",
            "cedilla",
            "çedilla",
            "nandu",
            "nota.md",
            "Nota.md",
            "nóta.md",
            "notas.md",
            "ñandú",
            "Ñandú",
            "uber",
            "Uber",
            "über",
            "zeta",
            "Zeta",
        ];
        assert_eq!(sorted(&input), expected);
    }
}
