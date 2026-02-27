use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct CanonicalJson {
    pub json: String,
    pub sha256: String,
}

pub fn canonicalize_json(value: &Value) -> Result<CanonicalJson, serde_json::Error> {
    let normalized = normalize(value);
    let json = serde_json::to_string(&normalized)?;
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    let sha256 = hex::encode(hasher.finalize());

    Ok(CanonicalJson { json, sha256 })
}

fn normalize(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<_> = map.iter().collect();
            entries.sort_by(|(a, _), (b, _)| a.cmp(b));

            let mut normalized = Map::with_capacity(entries.len());
            for (key, value) in entries {
                normalized.insert(key.clone(), normalize(value));
            }
            Value::Object(normalized)
        }
        Value::Array(values) => Value::Array(values.iter().map(normalize).collect()),
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonicalizes_object_keys_and_is_stable() {
        let a = json!({"b": 1, "a": {"z": 1, "x": 2}});
        let b = json!({"a": {"x": 2, "z": 1}, "b": 1});

        let a = canonicalize_json(&a).expect("canonicalize A");
        let b = canonicalize_json(&b).expect("canonicalize B");

        assert_eq!(a.json, b.json);
        assert_eq!(a.sha256, b.sha256);
        assert_eq!(a.json, "{\"a\":{\"x\":2,\"z\":1},\"b\":1}");
    }
}
