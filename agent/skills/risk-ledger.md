# Risk Ledger Skill

Risk scoring must be explainable and deterministic.

Default recommendations:
- Low: Go
- Medium: Review
- High: Block

Critical risk signals:
- Martingale or unlimited averaging down.
- High leverage or fast-loss-recovery language.
- Backtest max drawdown above 25%.

Review-level signals:
- Missing stop loss.
- Max drawdown above 15%.
- Sharpe below 0.5.
- Ambiguous strategy direction or exit.
- Thin trade sample.

Every risk report must include the triggered rule, evidence, and suggested next action.
