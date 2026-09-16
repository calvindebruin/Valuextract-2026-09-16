#!/usr/bin/env python3
"""Render a self-contained ValueXtract Agri HTML report from structured JSON."""

from __future__ import annotations

import argparse
import html
import json
import math
import sys
from pathlib import Path
from typing import Any


PRIORITIES = {"HIGH", "MEDIUM", "LOW"}
TIMELINES = {"Quick (0-3 months)", "Medium (3-9 months)", "Strategic (9+ months)"}
CONFIDENCE = {"High", "Medium", "Low"}
EVIDENCE_TYPES = {"Fact", "Calculation", "Inference"}


class DataError(ValueError):
    pass


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise DataError(message)


def validate(data: dict[str, Any]) -> None:
    expect(isinstance(data, dict), "Report data must be a JSON object.")
    required_top = {
        "client",
        "analysis_scope",
        "agri_business_insights",
        "opportunities",
        "top_priorities",
        "additional_information_requested",
        "basis_and_limitations",
    }
    missing = sorted(required_top - data.keys())
    expect(not missing, f"Missing top-level fields: {', '.join(missing)}")

    client = data["client"]
    expect(isinstance(client, dict), "client must be an object.")
    for key in ("name", "industry", "period", "document_type", "currency"):
        expect(nonempty(client.get(key)), f"client.{key} must be a non-empty string.")
    expect(len(client["currency"]) == 3 and client["currency"].isupper(), "client.currency must be a 3-letter uppercase code.")

    scope = data["analysis_scope"]
    expect(isinstance(scope, dict), "analysis_scope must be an object.")
    for key in ("documents", "entities", "periods"):
        expect(isinstance(scope.get(key), list), f"analysis_scope.{key} must be an array.")
        expect(all(nonempty(item) for item in scope[key]), f"analysis_scope.{key} must contain non-empty strings.")
    expect(isinstance(scope.get("scope_note"), str), "analysis_scope.scope_note must be a string.")

    insights = data["agri_business_insights"]
    expect(isinstance(insights, list) and 1 <= len(insights) <= 10, "agri_business_insights must contain 1-10 items.")
    expect(all(nonempty(item) for item in insights), "Every agri insight must be a non-empty string.")

    opportunities = data["opportunities"]
    expect(isinstance(opportunities, list), "opportunities must be an array.")
    seen_ids: set[str] = set()
    required_opportunity = {
        "trigger_id",
        "opportunity_name",
        "service_line",
        "agri_category",
        "financial_evidence",
        "finding",
        "why_this_matters",
        "how_we_can_assist",
        "recommended_solution",
        "engagement_details",
        "value_proposition",
        "calculation",
        "client_value_low",
        "client_value_high",
        "value_type",
        "fee_low",
        "fee_high",
        "roi",
        "priority",
        "timeline",
        "confidence",
    }

    for index, opportunity in enumerate(opportunities, start=1):
        prefix = f"opportunities[{index - 1}]"
        expect(isinstance(opportunity, dict), f"{prefix} must be an object.")
        missing_op = sorted(required_opportunity - opportunity.keys())
        expect(not missing_op, f"{prefix} missing fields: {', '.join(missing_op)}")
        for key in (
            "trigger_id",
            "opportunity_name",
            "service_line",
            "agri_category",
            "finding",
            "why_this_matters",
            "how_we_can_assist",
            "recommended_solution",
            "value_proposition",
            "value_type",
        ):
            expect(nonempty(opportunity[key]), f"{prefix}.{key} must be a non-empty string.")

        trigger_id = opportunity["trigger_id"]
        expect(trigger_id not in seen_ids, f"Duplicate trigger_id: {trigger_id}")
        seen_ids.add(trigger_id)
        expect(opportunity["priority"] in PRIORITIES, f"{prefix}.priority is invalid.")
        expect(opportunity["timeline"] in TIMELINES, f"{prefix}.timeline is invalid.")
        expect(opportunity["confidence"] in CONFIDENCE, f"{prefix}.confidence is invalid.")

        for key in ("client_value_low", "client_value_high", "fee_low", "fee_high", "roi"):
            expect(is_number(opportunity[key]) and opportunity[key] > 0, f"{prefix}.{key} must be a positive finite number.")
        expect(opportunity["client_value_low"] <= opportunity["client_value_high"], f"{prefix} client value range is reversed.")
        expect(opportunity["fee_low"] <= opportunity["fee_high"], f"{prefix} fee range is reversed.")

        calculated_roi = midpoint_roi(opportunity)
        tolerance = max(0.15, calculated_roi * 0.005)
        expect(abs(float(opportunity["roi"]) - calculated_roi) <= tolerance, f"{prefix}.roi must equal midpoint ROI ({calculated_roi:.2f}).")

        evidence = opportunity["financial_evidence"]
        expect(isinstance(evidence, list) and evidence, f"{prefix}.financial_evidence must contain at least one record.")
        for evidence_index, record in enumerate(evidence):
            ep = f"{prefix}.financial_evidence[{evidence_index}]"
            expect(isinstance(record, dict), f"{ep} must be an object.")
            for key in ("evidence_type", "description", "financial_period", "source_document", "source_section"):
                expect(nonempty(record.get(key)), f"{ep}.{key} must be a non-empty string.")
            expect(record["evidence_type"] in EVIDENCE_TYPES, f"{ep}.evidence_type is invalid.")
            expect("source_page" in record, f"{ep}.source_page is required; use null if unavailable.")
            expect(record["source_page"] is None or isinstance(record["source_page"], (str, int)), f"{ep}.source_page must be a string, integer, or null.")

        calculation = opportunity["calculation"]
        expect(isinstance(calculation, dict), f"{prefix}.calculation must be an object.")
        expect(nonempty(calculation.get("basis")), f"{prefix}.calculation.basis is required.")
        expect(nonempty(calculation.get("formula")), f"{prefix}.calculation.formula is required.")
        expect(isinstance(calculation.get("assumptions"), list), f"{prefix}.calculation.assumptions must be an array.")
        expect(all(nonempty(item) for item in calculation["assumptions"]), f"{prefix}.calculation.assumptions must contain non-empty strings.")

        engagement = opportunity["engagement_details"]
        expect(isinstance(engagement, dict), f"{prefix}.engagement_details must be an object.")
        for key in ("duration", "timeline", "pricing"):
            expect(nonempty(engagement.get(key)), f"{prefix}.engagement_details.{key} is required.")
        expect(engagement["timeline"] == opportunity["timeline"], f"{prefix} timeline fields must agree.")
        expect(isinstance(engagement.get("resources"), list) and engagement["resources"], f"{prefix}.engagement_details.resources must contain at least one role.")
        expect(all(nonempty(item) for item in engagement["resources"]), f"{prefix}.engagement_details.resources contains an empty role.")

    priorities = data["top_priorities"]
    expect(isinstance(priorities, list), "top_priorities must be an array.")
    expect(len(priorities) == min(3, len(opportunities)), "top_priorities must contain three items, or all opportunities when fewer than three exist.")
    priority_ids: set[str] = set()
    for index, item in enumerate(priorities):
        expect(isinstance(item, dict), f"top_priorities[{index}] must be an object.")
        expect(nonempty(item.get("trigger_id")) and nonempty(item.get("reason")), f"top_priorities[{index}] requires trigger_id and reason.")
        expect(item["trigger_id"] in seen_ids, f"top_priorities[{index}] references an unknown trigger_id.")
        expect(item["trigger_id"] not in priority_ids, f"Duplicate top priority: {item['trigger_id']}")
        priority_ids.add(item["trigger_id"])

    info_requests = data["additional_information_requested"]
    expect(isinstance(info_requests, list), "additional_information_requested must be an array.")
    for index, item in enumerate(info_requests):
        expect(isinstance(item, dict), f"additional_information_requested[{index}] must be an object.")
        expect(nonempty(item.get("item")) and nonempty(item.get("why")), f"additional_information_requested[{index}] requires item and why.")

    limitations = data["basis_and_limitations"]
    expect(isinstance(limitations, list), "basis_and_limitations must be an array.")
    expect(all(nonempty(item) for item in limitations), "basis_and_limitations must contain non-empty strings.")


def midpoint_roi(opportunity: dict[str, Any]) -> float:
    client_mid = (float(opportunity["client_value_low"]) + float(opportunity["client_value_high"])) / 2
    fee_mid = (float(opportunity["fee_low"]) + float(opportunity["fee_high"])) / 2
    return client_mid / fee_mid


def escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def prose(value: Any) -> str:
    return escape(value).replace("\n", "<br>")


def format_amount(value: float, currency: str) -> str:
    symbols = {"ZAR": "R", "USD": "$", "EUR": "€", "GBP": "£"}
    symbol = symbols.get(currency, f"{currency} ")
    number = f"{value:,.0f}" if float(value).is_integer() or abs(value) >= 1000 else f"{value:,.2f}"
    return f"{symbol}{number}"


def format_range(low: float, high: float, currency: str) -> str:
    return f"{format_amount(low, currency)} – {format_amount(high, currency)}"


def render_list(items: list[str], css_class: str = "") -> str:
    class_attr = f' class="{escape(css_class)}"' if css_class else ""
    return f"<ul{class_attr}>" + "".join(f"<li>{prose(item)}</li>" for item in items) + "</ul>"


def render_evidence(records: list[dict[str, Any]]) -> str:
    blocks = []
    for record in records:
        source = f"{record['source_document']} · {record['source_section']} · {record['financial_period']}"
        if record.get("source_page") is not None:
            source += f" · Page {record['source_page']}"
        blocks.append(
            '<div class="evidence-item">'
            f'<span class="evidence-type">{escape(record["evidence_type"])}</span>'
            f'<p>{prose(record["description"])}</p>'
            f'<p class="source">{escape(source)}</p>'
            "</div>"
        )
    return "".join(blocks)


def render_opportunity(opportunity: dict[str, Any], number: int, currency: str) -> str:
    roi = midpoint_roi(opportunity)
    engagement = opportunity["engagement_details"]
    calculation = opportunity["calculation"]
    assumptions = render_list(calculation["assumptions"]) if calculation["assumptions"] else '<p class="muted">No additional assumptions recorded.</p>'
    resources = ", ".join(escape(item) for item in engagement["resources"])
    return f"""
    <article class="opportunity-card" id="{escape(opportunity['trigger_id'])}">
      <div class="card-topline">
        <span class="op-number">#{number:02d}</span>
        <span class="badge priority-{escape(opportunity['priority'].lower())}">{escape(opportunity['priority'])}</span>
      </div>
      <p class="service-line">{escape(opportunity['service_line'])} · {escape(opportunity['agri_category'])}</p>
      <h3>{escape(opportunity['opportunity_name'])}</h3>
      <div class="op-metrics">
        <div><span>Client Value</span><strong>{format_range(opportunity['client_value_low'], opportunity['client_value_high'], currency)}</strong><small>{escape(opportunity['value_type'])}</small></div>
        <div><span>Firm Fees</span><strong>{format_range(opportunity['fee_low'], opportunity['fee_high'], currency)}</strong><small>{escape(engagement['pricing'])}</small></div>
        <div><span>Indicative ROI</span><strong class="positive">{roi:.1f}x</strong><small>{escape(opportunity['confidence'])} confidence</small></div>
      </div>
      <section><h4>Finding</h4><p>{prose(opportunity['finding'])}</p></section>
      <section><h4>Why This Matters</h4><p>{prose(opportunity['why_this_matters'])}</p></section>
      <section><h4>How We Can Assist</h4><p>{prose(opportunity['how_we_can_assist'])}</p></section>
      <section><h4>Recommended Solution</h4><p>{prose(opportunity['recommended_solution'])}</p></section>
      <section class="engagement">
        <h4>Engagement Details</h4>
        <dl>
          <div><dt>Duration</dt><dd>{escape(engagement['duration'])}</dd></div>
          <div><dt>Resources</dt><dd>{resources}</dd></div>
          <div><dt>Timeline</dt><dd>{escape(engagement['timeline'])}</dd></div>
          <div><dt>Pricing</dt><dd>{escape(engagement['pricing'])}</dd></div>
        </dl>
      </section>
      <section><h4>Value Proposition</h4><p>{prose(opportunity['value_proposition'])}</p></section>
      <details>
        <summary>Evidence & calculation</summary>
        {render_evidence(opportunity['financial_evidence'])}
        <div class="calculation"><strong>Basis</strong><p>{prose(calculation['basis'])}</p><strong>Formula</strong><p>{prose(calculation['formula'])}</p><strong>Assumptions</strong>{assumptions}</div>
      </details>
    </article>
    """


def render_report(data: dict[str, Any]) -> str:
    client = data["client"]
    currency = client["currency"]
    opportunities = data["opportunities"]
    value_low = sum(float(item["client_value_low"]) for item in opportunities)
    value_high = sum(float(item["client_value_high"]) for item in opportunities)
    fee_low = sum(float(item["fee_low"]) for item in opportunities)
    fee_high = sum(float(item["fee_high"]) for item in opportunities)
    overall_roi = ((value_low + value_high) / 2) / ((fee_low + fee_high) / 2) if fee_low + fee_high else None

    table_rows = "".join(
        f"""
        <tr>
          <td><a href="#{escape(item['trigger_id'])}">{escape(item['opportunity_name'])}</a></td>
          <td>{escape(item['service_line'])}</td>
          <td>{format_range(item['client_value_low'], item['client_value_high'], currency)}</td>
          <td>{format_range(item['fee_low'], item['fee_high'], currency)}</td>
          <td><span class="badge priority-{escape(item['priority'].lower())}">{escape(item['priority'])}</span></td>
          <td>{escape(item['timeline'])}</td>
        </tr>
        """
        for item in opportunities
    )
    if not table_rows:
        table_rows = '<tr><td colspan="6" class="empty">No sufficiently evidenced opportunities were identified.</td></tr>'

    cards = "".join(render_opportunity(item, i, currency) for i, item in enumerate(opportunities, start=1))
    opportunity_by_id = {item["trigger_id"]: item for item in opportunities}
    priorities = "".join(
        f"""
        <article class="priority-card">
          <span class="rank">{index}</span>
          <div><h3>{escape(opportunity_by_id[item['trigger_id']]['opportunity_name'])}</h3><p>{prose(item['reason'])}</p></div>
        </article>
        """
        for index, item in enumerate(data["top_priorities"], start=1)
    )
    if not priorities:
        priorities = '<p class="empty">No priorities were ranked because no sufficiently evidenced opportunities were identified.</p>'

    info_requests = "".join(
        f"<li><strong>{escape(item['item'])}</strong><span>{prose(item['why'])}</span></li>"
        for item in data["additional_information_requested"]
    )
    if not info_requests:
        info_requests = "<li><strong>No additional information requested</strong><span>The supplied information was sufficient for the current scope.</span></li>"

    report_date = client.get("report_date")
    report_date_html = f'<span>Report date: {escape(report_date)}</span>' if report_date else ""
    scope_note = data["analysis_scope"].get("scope_note", "")
    scope_note_html = f'<p class="scope-note">{prose(scope_note)}</p>' if scope_note else ""
    overall_roi_text = f"{overall_roi:.1f}x" if overall_roi is not None else "N/A"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ValueXtract Agri | {escape(client['name'])}</title>
  <style>
    :root {{ --background:#080D14; --card:#0D141D; --card-secondary:#111923; --border:#263140; --gold:#D5A64E; --gold-light:#E0B763; --text:#F5F5F5; --muted:#A6AFBC; --positive:#18D6A5; --danger-bg:#3a171c; --danger:#ff9da7; --amber-bg:#36280d; --amber:#efc266; --green-bg:#123127; --green:#75e0bb; --shadow:0 20px 50px rgba(0,0,0,.22); }}
    * {{ box-sizing:border-box; }}
    html {{ scroll-behavior:smooth; }}
    body {{ margin:0; background:var(--background); color:var(--text); font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.55; }}
    a {{ color:var(--gold-light); text-decoration:none; }} a:hover {{ text-decoration:underline; }}
    .page {{ width:min(1480px,calc(100% - 40px)); margin:0 auto; padding:48px 0 72px; }}
    .brand {{ color:var(--gold); font-size:.78rem; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }}
    .hero {{ position:relative; padding:44px; border:1px solid var(--border); border-top:3px solid var(--gold); border-radius:18px; background:linear-gradient(135deg,#0D141D 0%,#0B1119 65%,#151a1d 100%); box-shadow:var(--shadow); overflow:hidden; }}
    .hero::after {{ content:""; position:absolute; width:220px; height:220px; right:-100px; top:-120px; border:1px solid rgba(213,166,78,.28); border-radius:50%; }}
    .hero h1 {{ margin:.5rem 0 .75rem; max-width:1050px; font-size:clamp(2.1rem,5vw,4.5rem); line-height:1.02; letter-spacing:-.045em; }}
    .meta {{ display:flex; flex-wrap:wrap; gap:8px 22px; color:var(--muted); }} .meta span {{ white-space:nowrap; }}
    .scope-note {{ max-width:900px; margin:24px 0 0; color:var(--muted); border-left:2px solid var(--gold); padding-left:15px; }}
    .summary-grid {{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0 52px; }}
    .summary-card {{ min-height:150px; padding:24px; border:1px solid var(--border); border-radius:14px; background:var(--card); box-shadow:var(--shadow); }}
    .summary-card span {{ color:var(--muted); font-size:.72rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }}
    .summary-card strong {{ display:block; margin-top:18px; color:var(--text); font-size:clamp(1.45rem,2.5vw,2.2rem); line-height:1.15; font-variant-numeric:tabular-nums; }}
    .summary-card.roi strong {{ color:var(--positive); }}
    .section-heading {{ display:flex; align-items:end; justify-content:space-between; gap:20px; margin:46px 0 18px; }}
    .section-heading p {{ margin:0 0 5px; color:var(--gold); font-size:.75rem; font-weight:800; letter-spacing:.15em; text-transform:uppercase; }}
    h2 {{ margin:0; font-size:clamp(1.6rem,3vw,2.35rem); letter-spacing:-.025em; }}
    .insights {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; padding:0; list-style:none; }}
    .insights li {{ position:relative; padding:18px 18px 18px 43px; background:var(--card); border:1px solid var(--border); border-radius:12px; }}
    .insights li::before {{ content:""; position:absolute; left:19px; top:26px; width:8px; height:8px; border-radius:50%; background:var(--gold); box-shadow:0 0 0 5px rgba(213,166,78,.12); }}
    .table-wrap {{ overflow-x:auto; border:1px solid var(--border); border-radius:14px; background:var(--card); }}
    table {{ width:100%; min-width:920px; border-collapse:collapse; }} th,td {{ padding:16px 18px; text-align:left; border-bottom:1px solid var(--border); vertical-align:top; }}
    th {{ color:var(--muted); background:var(--card-secondary); font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; }} td {{ font-size:.88rem; font-variant-numeric:tabular-nums; }} tr:last-child td {{ border-bottom:0; }}
    .badge {{ display:inline-flex; align-items:center; justify-content:center; min-width:74px; padding:5px 9px; border-radius:999px; font-size:.68rem; font-weight:900; letter-spacing:.08em; }}
    .priority-high {{ color:var(--danger); background:var(--danger-bg); }} .priority-medium {{ color:var(--amber); background:var(--amber-bg); }} .priority-low {{ color:var(--green); background:var(--green-bg); }}
    .opportunity-grid {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }}
    .opportunity-card {{ padding:26px; border:1px solid var(--border); border-radius:16px; background:var(--card); box-shadow:var(--shadow); break-inside:avoid; }}
    .card-topline {{ display:flex; justify-content:space-between; align-items:center; }} .op-number {{ color:var(--gold); font-weight:850; letter-spacing:.08em; }}
    .service-line {{ margin:20px 0 5px; color:var(--gold-light); font-size:.75rem; font-weight:750; letter-spacing:.06em; text-transform:uppercase; }}
    .opportunity-card h3 {{ margin:0 0 20px; font-size:1.48rem; line-height:1.18; letter-spacing:-.025em; }}
    .op-metrics {{ display:grid; grid-template-columns:1.35fr 1.35fr .75fr; gap:8px; margin:0 0 22px; }}
    .op-metrics>div {{ min-width:0; padding:12px; background:var(--card-secondary); border:1px solid var(--border); border-radius:10px; }}
    .op-metrics span,.op-metrics small {{ display:block; color:var(--muted); font-size:.66rem; line-height:1.35; }} .op-metrics strong {{ display:block; margin:6px 0 4px; font-size:.93rem; font-variant-numeric:tabular-nums; }} .positive {{ color:var(--positive)!important; }}
    .opportunity-card section {{ margin-top:19px; }} h4 {{ margin:0 0 6px; color:var(--muted); font-size:.7rem; letter-spacing:.095em; text-transform:uppercase; }} .opportunity-card p {{ margin:0; color:#d7dce2; font-size:.91rem; }}
    .engagement {{ padding:15px; background:var(--card-secondary); border:1px solid var(--border); border-radius:10px; }} dl {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 18px; margin:0; }} dl div {{ min-width:0; }} dt {{ color:var(--muted); font-size:.67rem; text-transform:uppercase; letter-spacing:.07em; }} dd {{ margin:2px 0 0; font-size:.84rem; }}
    details {{ margin-top:20px; border-top:1px solid var(--border); padding-top:15px; }} summary {{ color:var(--gold-light); cursor:pointer; font-weight:750; font-size:.83rem; }}
    .evidence-item {{ margin-top:12px; padding:12px; border-radius:9px; background:var(--card-secondary); }} .evidence-type {{ color:var(--gold); font-size:.66rem; font-weight:850; text-transform:uppercase; letter-spacing:.08em; }} .evidence-item .source {{ margin-top:7px; color:var(--muted); font-size:.75rem; }}
    .calculation {{ margin-top:12px; color:#d7dce2; font-size:.84rem; }} .calculation>strong {{ display:block; margin-top:8px; color:var(--muted); font-size:.66rem; text-transform:uppercase; letter-spacing:.08em; }} .calculation ul {{ margin:5px 0 0; padding-left:18px; }} .muted,.empty {{ color:var(--muted)!important; }}
    .priority-list {{ display:grid; gap:12px; }} .priority-card {{ display:flex; gap:18px; padding:20px; border:1px solid var(--border); border-radius:12px; background:var(--card); }} .rank {{ display:grid; place-items:center; flex:0 0 42px; height:42px; border:1px solid var(--gold); border-radius:50%; color:var(--gold); font-weight:900; }} .priority-card h3 {{ margin:0 0 5px; font-size:1.05rem; }} .priority-card p {{ margin:0; color:var(--muted); }}
    .info-list {{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; padding:0; list-style:none; }} .info-list li {{ padding:18px; border:1px solid var(--border); border-radius:12px; background:var(--card); }} .info-list strong,.info-list span {{ display:block; }} .info-list span {{ margin-top:6px; color:var(--muted); font-size:.88rem; }}
    .limitations {{ padding:22px 22px 22px 42px; border:1px solid var(--border); border-radius:12px; background:var(--card-secondary); color:var(--muted); }}
    footer {{ margin-top:50px; padding-top:20px; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:20px; color:var(--muted); font-size:.74rem; }}
    :focus-visible {{ outline:2px solid var(--gold-light); outline-offset:3px; }}
    @media (max-width:1050px) {{ .summary-grid {{ grid-template-columns:repeat(2,minmax(0,1fr)); }} .opportunity-grid {{ grid-template-columns:1fr; }} }}
    @media (max-width:680px) {{ .page {{ width:min(100% - 24px,1480px); padding-top:18px; }} .hero {{ padding:28px 22px; }} .summary-grid,.insights,.info-list {{ grid-template-columns:1fr; }} .summary-card {{ min-height:120px; }} .opportunity-card {{ padding:21px; }} .op-metrics {{ grid-template-columns:1fr; }} dl {{ grid-template-columns:1fr; }} footer {{ flex-direction:column; }} }}
    @media print {{ :root {{ --background:#fff; --card:#fff; --card-secondary:#f5f6f7; --border:#c8cdd3; --text:#111820; --muted:#4e5966; --gold:#8a6222; --gold-light:#6f4d16; --positive:#08765b; }} body {{ background:#fff; }} .page {{ width:100%; padding:0; }} .hero,.summary-card,.opportunity-card {{ box-shadow:none; }} .opportunity-grid {{ display:block; }} .opportunity-card {{ margin-bottom:14px; page-break-inside:avoid; }} details {{ display:block; }} details>summary {{ display:none; }} details>* {{ display:block!important; }} a {{ color:inherit; text-decoration:none; }} thead {{ display:table-header-group; }} }}
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="brand">ValueXtract · Agri Opportunity Report</div>
      <h1>{escape(client['name'])}</h1>
      <div class="meta">
        <span>{escape(client['industry'])}</span><span>{escape(client['period'])}</span><span>{escape(client['document_type'])}</span><span>Currency: {escape(currency)}</span>{report_date_html}
      </div>
      {scope_note_html}
    </header>

    <section class="summary-grid" aria-label="Report summary">
      <article class="summary-card"><span>Client Value Range</span><strong>{format_range(value_low, value_high, currency) if opportunities else 'N/A'}</strong></article>
      <article class="summary-card"><span>Firm Fee Range</span><strong>{format_range(fee_low, fee_high, currency) if opportunities else 'N/A'}</strong></article>
      <article class="summary-card roi"><span>Overall Indicative ROI</span><strong>{overall_roi_text}</strong></article>
      <article class="summary-card"><span>Opportunities</span><strong>{len(opportunities)}</strong></article>
    </section>

    <section>
      <div class="section-heading"><div><p>Executive view</p><h2>Agri Business Insights</h2></div></div>
      {render_list(data['agri_business_insights'], 'insights')}
    </section>

    <section>
      <div class="section-heading"><div><p>Opportunity portfolio</p><h2>Advisory Opportunities ({len(opportunities)})</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Opportunity</th><th>Service Line</th><th>Client Value</th><th>Firm Fees</th><th>Priority</th><th>Timeline</th></tr></thead><tbody>{table_rows}</tbody></table></div>
    </section>

    <section>
      <div class="section-heading"><div><p>Evidence to action</p><h2>Opportunity Detail</h2></div></div>
      <div class="opportunity-grid">{cards}</div>
    </section>

    <section>
      <div class="section-heading"><div><p>Recommended sequence</p><h2>Top 3 Value Creation Priorities</h2></div></div>
      <div class="priority-list">{priorities}</div>
    </section>

    <section>
      <div class="section-heading"><div><p>Decision-critical gaps</p><h2>Additional Information Requested</h2></div></div>
      <ul class="info-list">{info_requests}</ul>
    </section>

    <section>
      <div class="section-heading"><div><p>Important context</p><h2>Basis, Assumptions & Limitations</h2></div></div>
      {render_list(data['basis_and_limitations'], 'limitations')}
    </section>

    <footer><span>ValueXtract - Agri</span><span>Indicative opportunity analysis · Not an audit opinion, legal opinion, financing offer, or guarantee of value</span></footer>
  </main>
</body>
</html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a ValueXtract Agri report from JSON.")
    parser.add_argument("input", type=Path, help="Path to valuextract-data.json")
    parser.add_argument("--output", "-o", type=Path, help="Output HTML path")
    parser.add_argument("--check-only", action="store_true", help="Validate data without rendering")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        with args.input.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        validate(data)
        if args.check_only:
            print(f"Valid ValueXtract Agri data: {args.input}")
            return 0
        output = args.output or args.input.with_suffix(".html")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(render_report(data), encoding="utf-8")
        print(f"Rendered ValueXtract Agri report: {output}")
        return 0
    except (OSError, json.JSONDecodeError, DataError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
