use jsonschema::Draft;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;

static CAPABILITY_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-z0-9]+(\.[a-z0-9]+)+@v[1-9][0-9]*$").expect("capability id regex")
});

pub fn is_valid_capability_id(id: &str) -> bool {
    CAPABILITY_RE.is_match(id)
}

pub fn validate_json_with_schema(schema: &Value, payload: &Value) -> Result<(), Vec<String>> {
    let validator = jsonschema::options()
        .with_draft(Draft::Draft202012)
        .build(schema)
        .map_err(|e| vec![format!("invalid schema: {e}")])?;

    let validation = validator.validate(payload);
    match validation {
        Ok(_) => Ok(()),
        Err(errors) => {
            let details = errors.map(|e| e.to_string()).collect::<Vec<_>>();
            Err(details)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_capability_id_format() {
        assert!(is_valid_capability_id("rag.search@v1"));
        assert!(is_valid_capability_id("doc.update.title@v2"));
        assert!(!is_valid_capability_id("rag@v1"));
        assert!(!is_valid_capability_id("rag.search@v0"));
    }

    #[test]
    fn validates_payload_against_schema() {
        let schema = json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "query": { "type": "string" }
            },
            "required": ["query"]
        });

        let ok = json!({ "query": "hello" });
        let bad = json!({ "query": 3 });

        assert!(validate_json_with_schema(&schema, &ok).is_ok());
        assert!(validate_json_with_schema(&schema, &bad).is_err());
    }
}
