use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{ErrorBody, ErrorEnvelope};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Unauthorized,
    Forbidden,
    BudgetExceeded,
    CapabilityNotFound,
    NoHealthyProviders,
    SchemaValidationFailed,
    WorkerTimeout,
    WorkerError,
    Internal,
}

#[derive(Debug, thiserror::Error, Clone)]
#[error("{code:?}: {message}")]
pub struct RelayOrbError {
    pub code: ErrorCode,
    pub message: String,
    pub details: Value,
}

impl RelayOrbError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: Value::Object(Default::default()),
        }
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = details;
        self
    }

    pub fn status_code(&self) -> StatusCode {
        match self.code {
            ErrorCode::Unauthorized => StatusCode::UNAUTHORIZED,
            ErrorCode::Forbidden => StatusCode::FORBIDDEN,
            ErrorCode::BudgetExceeded => StatusCode::TOO_MANY_REQUESTS,
            ErrorCode::CapabilityNotFound => StatusCode::NOT_FOUND,
            ErrorCode::NoHealthyProviders => StatusCode::SERVICE_UNAVAILABLE,
            ErrorCode::SchemaValidationFailed => StatusCode::BAD_REQUEST,
            ErrorCode::WorkerTimeout => StatusCode::GATEWAY_TIMEOUT,
            ErrorCode::WorkerError => StatusCode::BAD_GATEWAY,
            ErrorCode::Internal => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Debug)]
pub struct ApiError {
    pub request_id: String,
    pub trace_id: String,
    pub inner: RelayOrbError,
}

impl ApiError {
    pub fn from_inner(
        request_id: impl Into<String>,
        trace_id: impl Into<String>,
        inner: RelayOrbError,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            trace_id: trace_id.into(),
            inner,
        }
    }

    pub fn internal(
        request_id: impl Into<String>,
        trace_id: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            trace_id: trace_id.into(),
            inner: RelayOrbError::new(ErrorCode::Internal, message),
        }
    }

    pub fn envelope(&self) -> ErrorEnvelope {
        ErrorEnvelope {
            request_id: self.request_id.clone(),
            trace_id: self.trace_id.clone(),
            status: "error".to_string(),
            error: ErrorBody {
                code: self.inner.code,
                message: self.inner.message.clone(),
                details: self.inner.details.clone(),
            },
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.inner.status_code(), Json(self.envelope())).into_response()
    }
}
