import logging
import uuid
from datetime import datetime, timezone

from app.core.config import get_settings
from app.schemas.analysis import AnalyzeRequest, Finding, Report
from app.services import llm, rules
from app.services.affordability import compute_affordability
from app.services.catalog import load_catalog

log = logging.getLogger("safebuy.analysis")


async def run_analysis(req: AnalyzeRequest) -> Report:
    l, catalog = req.listing, load_catalog()
    notes: list[str] = []
    pc, low_median = rules.price_context(l, catalog, req.catalog_id)
    afford = compute_affordability(l.price, req.budget.available, req.budget.existing, l.currency, catalog, req.catalog_id)
    insufficient = rules.is_insufficient(l)

    findings: list[Finding] | None = None
    missing: list[str] = []
    mode, model, assessment, summary, next_step = "demo-rules", None, None, None, None

    settings = get_settings()
    if settings.llm_configured and not insufficient:
        try:
            try:
                raw = await llm.call_llm(req)
                analysis, dropped = llm.parse_llm_output(raw, l.all_text())
            except llm.LLMInvalidOutput:  # one retry for malformed output
                raw = await llm.call_llm(req)
                analysis, dropped = llm.parse_llm_output(raw, l.all_text())
            findings = [Finding(id=f"f{i + 1}", title=f.title, severity=f.severity, confidence=f.confidence, observed=f.observed,
                                source=f'Listing text: "{f.evidence_quote}"' if f.evidence_quote else
                                ("Absent from the supplied information" if f.basis == "absence" else "Inference from the supplied information"),
                                why_it_matters=f.why_it_matters, verify=f.verify) for i, f in enumerate(analysis.findings)]
            missing, assessment, summary, next_step = analysis.missing_information, analysis.assessment, analysis.summary, analysis.next_step
            mode, model = "llm", settings.llm_model
            if dropped:
                notes.append(f"{dropped} AI finding(s) were removed because their quoted evidence wasn't found in the listing text.")
            if not findings and assessment != "Insufficient information to assess" and not missing:
                notes.append("The AI reported no concerns. That reflects only the text supplied.")
        except (llm.LLMUnavailable, llm.LLMInvalidOutput) as e:
            log.warning("LLM analysis failed, using rule-based fallback: %s", e)
            notes.append(f"Live AI analysis was unavailable ({e}). Showing rule-based results instead.")
    elif not settings.llm_configured:
        notes.append("No AI key is configured on the server, so this is a rule-based demo analysis.")

    if findings is None:
        findings, missing = rules.rule_findings(l, low_median)
        assessment = rules.assess(findings, insufficient)
        summary = ("There isn't enough information to assess this listing." if insufficient else
                   f"Based only on the supplied text, we found {len(findings)} item{'' if len(findings) == 1 else 's'} to check.")
        next_step = ("Add more of the listing text and seller details, then re-analyze." if insufficient else
                     f"Verify: {findings[0].verify}" if findings else
                     "Nothing stood out in what you supplied. Review the return terms once more, then decide.")
    if insufficient:
        assessment, notes = "Insufficient information to assess", notes + ["Too little was supplied to assess this listing."]

    return Report(id=f"r-{uuid.uuid4().hex[:12]}", created_at=datetime.now(timezone.utc), mode=mode, model=model, notes=notes, catalog_id=req.catalog_id,
                  listing=l, budget=req.budget, assessment=assessment, summary=summary, observed=rules.observed_facts(l),
                  findings=findings, missing=missing, seller=rules.seller_transparency(l), price_context=pc,
                  affordability=afford, next_step=next_step)
