import { atomicToDecimal } from "./decimal.js";
import { SOLANA_PROFILE } from "./constants.js";
import { verifyRecord } from "./receipt.js";

export function formatDecision(record, { details = false } = {}) {
  const policy = record.plan.policy;
  const decision = record.decision;
  const evidence = record.evidence;
  const lines = [
    "PROTECTED PAYBOX · SIMULATED FIXTURE · NO SIGNATURE · NO BROADCAST",
    "",
    "Mandate",
    `Swap exactly ${policy.economics.exact_sell_amount_display} ${policy.assets.sell.symbol} for at least ${policy.economics.minimum_receive_display} ${policy.assets.buy.symbol} on ${policy.network.chain_name}.`,
    `Limits: ${policy.economics.max_slippage_bps} bps slippage; ${policy.economics.max_price_impact_bps} bps price impact; ${policy.economics.max_network_fee_display} SOL network fee; ${policy.economics.max_priority_fee_display} SOL priority fee.`,
    "One use; output must return to the same wallet.",
    "",
    "Exact proposal",
  ];
  if (evidence) {
    lines.push(
      `Local route fixture: ${evidence.quote.builder}; receive ${atomicToDecimal(evidence.simulation.buy_credit_atomic, SOLANA_PROFILE.buy_decimals)} SOL; fee ${atomicToDecimal(evidence.simulation.network_fee_atomic, SOLANA_PROFILE.buy_decimals)} SOL.`,
    );
  } else {
    lines.push("No proposal was evaluated.");
  }
  lines.push(
    "",
    `${decision.outcome} — ${decision.reason}`,
  );
  if (decision.recovery) lines.push(`Recovery: ${decision.recovery}`);
  if (evidence) {
    lines.push(record.checks.length > 0
      ? `Checked: ${record.checks.join(", ")} at ${evidence.collected_at}.`
      : `Evidence reviewed at ${evidence.collected_at}; no policy check was treated as complete.`);
  }
  lines.push(
    `Boundary: ${record.boundary.statement}`,
    `Receipt: ${verifyRecord(record).verified ? "local checksum self-consistent; not signed" : "checksum verification failed"}.`,
  );
  if (details) {
    lines.push(
      "",
      "Technical details",
      `Policy digest: ${record.plan.policy_digest}`,
      `Message digest: ${record.proposal?.message?.message_sha256 ?? "unavailable"}`,
      `Receipt digest: ${record.receipt.receipt_digest}`,
      `Record digest: ${record.record_digest}`,
    );
  }
  return lines.join("\n");
}

export function renderHtml(record) {
  const verification = verifyRecord(record);
  const outcome = escapeHtml(record.decision.outcome);
  const color =
    record.decision.outcome === "PASS"
      ? "#0f766e"
      : record.decision.outcome === "BLOCK"
        ? "#b42318"
        : "#a15c00";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Protected PayBox ${outcome}</title>
  <style>
    :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f4f2ec;color:#17211b}
    body{margin:0;padding:40px 20px}.shell{max-width:820px;margin:auto}.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#637066}
    .card{background:#fff;border:1px solid #dfe3dd;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(29,43,34,.08)}
    h1{font-size:38px;line-height:1.05;margin:8px 0 24px}.verdict{border-left:5px solid ${color};padding:14px 18px;background:#f8faf8;border-radius:8px}
    .verdict strong{color:${color};font-size:22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}
    .fact{padding:16px;background:#f7f6f2;border-radius:12px}.fact b{display:block;margin-bottom:5px}code{font-size:12px;overflow-wrap:anywhere}
    .boundary{margin-top:22px;padding-top:18px;border-top:1px solid #e4e7e2;font-weight:650}@media(max-width:640px){.grid{grid-template-columns:1fr}h1{font-size:30px}}
  </style>
</head>
<body><main class="shell"><div class="eyebrow">Independent Delta prototype</div><h1>Protected PayBox</h1><section class="card">
  <div class="verdict"><strong>${outcome}</strong><p>${escapeHtml(record.decision.reason)}</p></div>
  <div class="grid">
    <div class="fact"><b>Mandate</b>${escapeHtml(record.plan.policy.economics.exact_sell_amount_display)} USDC → at least ${escapeHtml(record.plan.policy.economics.minimum_receive_display)} SOL</div>
    <div class="fact"><b>Network</b>Solana Mainnet · self-recipient</div>
    <div class="fact"><b>Builder</b>${escapeHtml(record.evidence?.quote?.builder ?? "Not reached")}</div>
    <div class="fact"><b>Receipt</b>${verification.verified ? "Local checksum self-consistent; not signed" : "Checksum verification failed"}</div>
  </div>
  <p><b>Why:</b> ${escapeHtml(record.decision.reason)}</p>
  ${record.decision.recovery ? `<p><b>Recovery:</b> ${escapeHtml(record.decision.recovery)}</p>` : ""}
  <div class="boundary">${escapeHtml(record.boundary.statement)}</div>
  <p><small>This fixture is not PayBox data, a production Delta proof, or evidence that a transaction executed.</small></p>
  <code>${escapeHtml(record.receipt.receipt_digest)}</code>
</section></main></body></html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
