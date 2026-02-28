use uuid::Uuid;

pub fn trace_id_from_traceparent(value: &str) -> Option<String> {
    let parts = value.trim().split('-').collect::<Vec<_>>();
    if parts.len() != 4 {
        return None;
    }

    let trace_id = parts[1].to_ascii_lowercase();
    if trace_id.len() != 32 || !is_hex(&trace_id) || trace_id.chars().all(|c| c == '0') {
        return None;
    }

    Some(trace_id)
}

pub fn traceparent_from_trace_id(trace_id: &str) -> Option<String> {
    let normalized_trace_id = normalize_trace_id(trace_id)?;
    let span_hex = Uuid::new_v4().simple().to_string();
    let span_id = &span_hex[..16];
    Some(format!("00-{normalized_trace_id}-{span_id}-01"))
}

fn normalize_trace_id(value: &str) -> Option<String> {
    let normalized = value.trim().replace('-', "").to_ascii_lowercase();
    if normalized.len() != 32 || !is_hex(&normalized) || normalized.chars().all(|c| c == '0') {
        return None;
    }
    Some(normalized)
}

fn is_hex(value: &str) -> bool {
    value.as_bytes().iter().all(u8::is_ascii_hexdigit)
}

#[cfg(test)]
mod tests {
    use super::{trace_id_from_traceparent, traceparent_from_trace_id};

    #[test]
    fn parses_valid_traceparent() {
        let parsed =
            trace_id_from_traceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        assert_eq!(parsed.as_deref(), Some("4bf92f3577b34da6a3ce929d0e0e4736"));
    }

    #[test]
    fn rejects_invalid_traceparent() {
        assert!(trace_id_from_traceparent("not-a-traceparent").is_none());
        assert!(trace_id_from_traceparent(
            "00-00000000000000000000000000000000-00f067aa0ba902b7-01"
        )
        .is_none());
    }

    #[test]
    fn builds_traceparent_from_uuid_trace_id() {
        let built = traceparent_from_trace_id("550e8400-e29b-41d4-a716-446655440000")
            .expect("traceparent should be generated");
        let parts = built.split('-').collect::<Vec<_>>();
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "00");
        assert_eq!(parts[1], "550e8400e29b41d4a716446655440000");
        assert_eq!(parts[2].len(), 16);
        assert_eq!(parts[3], "01");
    }
}
