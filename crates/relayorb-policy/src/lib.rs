use anyhow::Context;
use relayorb_core::{CapabilitySideEffects, ErrorCode, RelayOrbError};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use time::OffsetDateTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllowRule {
    pub role: String,
    pub capability_prefix: String,
    pub side_effects: CapabilitySideEffects,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetConfig {
    pub default_limit_per_minute: u64,
    pub window_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyConfig {
    #[serde(default)]
    pub allow: Vec<AllowRule>,
    pub budget: BudgetConfig,
}

pub struct PolicyEngine {
    config: PolicyConfig,
}

impl PolicyEngine {
    pub fn from_file(path: &str) -> anyhow::Result<Self> {
        let cfg = config::Config::builder()
            .add_source(config::File::with_name(path))
            .build()
            .with_context(|| format!("failed to load policy file at {path}"))?;

        let config: PolicyConfig = cfg
            .try_deserialize()
            .context("failed to deserialize policy config")?;

        Ok(Self { config })
    }

    pub fn authorize(
        &self,
        role: &str,
        capability_id: &str,
        side_effects: &CapabilitySideEffects,
    ) -> Result<(), RelayOrbError> {
        let allowed = self.config.allow.iter().any(|rule| {
            rule.role == role
                && capability_id.starts_with(&rule.capability_prefix)
                && &rule.side_effects == side_effects
        });

        if allowed {
            Ok(())
        } else {
            Err(RelayOrbError::new(
                ErrorCode::Forbidden,
                format!("role '{role}' is not allowed to invoke '{capability_id}'"),
            ))
        }
    }

    pub fn budget_config(&self) -> &BudgetConfig {
        &self.config.budget
    }
}

#[derive(Clone)]
pub struct SqliteBudgetStore {
    pool: SqlitePool,
    config: BudgetConfig,
}

impl SqliteBudgetStore {
    pub async fn new(pool: SqlitePool, config: BudgetConfig) -> anyhow::Result<Self> {
        let store = Self { pool, config };
        store.init().await?;
        Ok(store)
    }

    async fn init(&self) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS budget_counters (
                budget_key TEXT NOT NULL,
                window_start INTEGER NOT NULL,
                used INTEGER NOT NULL,
                PRIMARY KEY (budget_key, window_start)
            );
            "#,
        )
        .execute(&self.pool)
        .await
        .context("failed to initialize budget counters table")?;

        Ok(())
    }

    pub async fn enforce(&self, key: &str) -> Result<(), RelayOrbError> {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let window = self.config.window_seconds;
        let window_start = now - (now % window);

        let mut tx = self.pool.begin().await.map_err(|_| {
            RelayOrbError::new(ErrorCode::Internal, "failed to start budget transaction")
        })?;

        let current: Option<i64> = sqlx::query_scalar(
            "SELECT used FROM budget_counters WHERE budget_key = ?1 AND window_start = ?2",
        )
        .bind(key)
        .bind(window_start)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| RelayOrbError::new(ErrorCode::Internal, "failed reading budget counter"))?;

        let used = current.unwrap_or(0);
        if used as u64 >= self.config.default_limit_per_minute {
            let _ = tx.rollback().await;
            return Err(RelayOrbError::new(
                ErrorCode::BudgetExceeded,
                "budget exceeded for current window",
            )
            .with_details(json!({
                "budgetKey": key,
                "windowStart": window_start,
                "limit": self.config.default_limit_per_minute
            })));
        }

        sqlx::query(
            r#"
            INSERT INTO budget_counters (budget_key, window_start, used)
            VALUES (?1, ?2, 1)
            ON CONFLICT(budget_key, window_start)
            DO UPDATE SET used = used + 1
            "#,
        )
        .bind(key)
        .bind(window_start)
        .execute(&mut *tx)
        .await
        .map_err(|_| RelayOrbError::new(ErrorCode::Internal, "failed updating budget counter"))?;

        tx.commit().await.map_err(|_| {
            RelayOrbError::new(ErrorCode::Internal, "failed to commit budget transaction")
        })?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use relayorb_core::CapabilitySideEffects;

    #[tokio::test]
    async fn policy_and_budget_enforcement_work() {
        let cfg = PolicyConfig {
            allow: vec![AllowRule {
                role: "researcher".to_string(),
                capability_prefix: "rag.".to_string(),
                side_effects: CapabilitySideEffects::ReadOnly,
            }],
            budget: BudgetConfig {
                default_limit_per_minute: 1,
                window_seconds: 60,
            },
        };

        let engine = PolicyEngine {
            config: cfg.clone(),
        };
        assert!(engine
            .authorize(
                "researcher",
                "rag.search@v1",
                &CapabilitySideEffects::ReadOnly
            )
            .is_ok());
        assert!(engine
            .authorize(
                "researcher",
                "doc.write@v1",
                &CapabilitySideEffects::Mutating
            )
            .is_err());

        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("sqlite pool");
        let store = SqliteBudgetStore::new(pool, cfg.budget)
            .await
            .expect("budget store");

        assert!(store.enforce("agent-1").await.is_ok());
        let err = store
            .enforce("agent-1")
            .await
            .expect_err("expected budget exceeded");
        assert_eq!(err.code, ErrorCode::BudgetExceeded);
    }
}
