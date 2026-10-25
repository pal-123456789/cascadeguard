#!/usr/bin/env python3
"""Build CascadeGuard pitch deck (2-minute demo) using python-pptx."""
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.chart import XL_CHART_TYPE

# Theme colors matching CascadeGuard UI tokens
VOID = RGBColor(0x0B, 0x0F, 0x17)
PANEL = RGBColor(0x11, 0x1C, 0x2E)
PANEL2 = RGBColor(0x14, 0x1A, 0x2B)
EDGE = RGBColor(0x1E, 0x29, 0x3B)
SKY = RGBColor(0x38, 0xBD, 0xF8)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)
SLATE300 = RGBColor(0x94, 0xA3, 0xB8)
WHITE = RGBColor(0xF1, 0xF5, 0xF9)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

def bg(slide, color=VOID):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def rect(slide, left, top, w, h, color):
    r = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = color
    r.line.fill.background()
    return r

def rounded_rect(slide, left, top, w, h, color):
    r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = color
    r.line.fill.background()
    # small radius for modern look
    r.adjustments[0] = 0.05
    return r

def header_text(slide, text, top=Inches(0.35), size=Pt(18), bold=True):
    box = slide.shapes.add_textbox(Inches(0.55), top, Inches(12.2), Inches(0.7))
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = text; r.font.color.rgb = SKY; r.font.size = size; r.font.bold = bold; r.font.name = "Inter"
    return box

def body_textbox(slide, text, left, top, w, h, size=Pt(15), color=SLATE300, bold=False):
    box = slide.shapes.add_textbox(left, top, w, h)
    tf = box.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
    r = p.add_run(); r.text = text; r.font.color.rgb = color; r.font.size = size; r.font.bold = bold; r.font.name = "Inter"
    return box

def footer(slide, label="ORCATHON 2026 · TRACK 01 SOFTWARE & AI"):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.55), Inches(7.05), Inches(12.2), Inches(0.02))
    line.fill.solid(); line.fill.fore_color.rgb = EDGE; line.line.fill.background()
    body_textbox(slide, label, Inches(0.55), Inches(7.15), Inches(7), Inches(0.3), size=Pt(9), color=RGBColor(0x64, 0x74, 0x8B))

# ===================================================================
# SLIDE 1 — HOOK / TITLE
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
bg(slide, VOID)
# Large decorative glow behind title
glow = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(7.8), Inches(1.2), Inches(5), Inches(3.5))
glow.fill.solid(); glow.fill.fore_color.rgb = RGBColor(0x14, 0x27, 0x3E)
glow.line.fill.background()

body_textbox(slide, "ORCATHON 2026  ·  TRACK 01  SOFTWARE & AI", Inches(0.8), Inches(1.2), Inches(11), Inches(0.8), size=Pt(20), color=SKY, bold=False)
# Main title
title_box = slide.shapes.add_textbox(Inches(0.8), Inches(2.2), Inches(11.5), Inches(2.2))
tf = title_box.text_frame; tf.word_wrap = True
p = tf.paragraphs[0]; p.alignment = PP_ALIGN.LEFT
r = p.add_run(); r.text = "CascadeGuard"; r.font.color.rgb = WHITE; r.font.size = Pt(72); r.font.bold = True; r.font.name = "Inter"
p = tf.add_paragraph(); p.space_before = Pt(6); p.alignment = PP_ALIGN.LEFT
r = p.add_run(); r.text = "See the outage before it happens."; r.font.color.rgb = SKY; r.font.size = Pt(32); r.font.bold = False; r.font.name = "Inter"

# Tagline / proof bar
rounded_rect(slide, Inches(0.8), Inches(5.0), Inches(5.2), Inches(1.0), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "Measured: 100% recall · 100% origin accuracy · 75s average lead time", Inches(1.0), Inches(5.2), Inches(4.8), Inches(0.7), size=Pt(13), color=WHITE, bold=True)
body_textbox(slide, "Predict cascading software failures · trace root causes · recommend optimal recovery — verified live against ground truth.", Inches(0.8), Inches(6.1), Inches(11.5), Inches(0.8), size=Pt(15), color=SLATE300)
footer(slide)

# ===================================================================
# SLIDE 2 — THE PROBLEM (Digital Twin)
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "01  THE PROBLEM  ·  A live digital twin of an e-commerce cluster")

# Visual cluster diagram (simplified 9-node topology)
# Gateway (center top), DB/Cache/APIs arranged below
nodes = [
    ("edge-gateway", Inches(5.5), Inches(2.2), RGBColor(0xF5, 0x9E, 0x0B)),  # amber = gateway
    ("auth-service", Inches(3.2), Inches(3.8), RGBColor(0x34, 0xD3, 0x99)),
    ("orders-api", Inches(6.5), Inches(3.8), RGBColor(0x38, 0xBD, 0xF8)),
    ("inventory-api", Inches(8.8), Inches(3.8), RGBColor(0x38, 0xBD, 0xF8)),
    ("orders-db", Inches(5.0), Inches(5.1), RGBColor(0xF8, 0x71, 0x71)),  # red = failing
    ("payments-api", Inches(3.2), Inches(5.4), RGBColor(0x34, 0xD3, 0x99)),
    ("redis-cache", Inches(8.4), Inches(5.4), RGBColor(0xF5, 0x9E, 0x0B)),
    ("payments-db", Inches(6.6), Inches(5.4), RGBColor(0x34, 0xD3, 0x99)),
]
for name, x, y, c in nodes:
    circ = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, Inches(1.0), Inches(0.55))
    circ.fill.solid(); circ.fill.fore_color.rgb = c
    circ.line.fill.background()
    label = slide.shapes.add_textbox(x, y + Inches(0.22), Inches(1.0), Inches(0.3))
    tf = label.text_frame; tf.word_wrap = False; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    r = tf.paragraphs[0].add_run(); r.text = name; r.font.color.rgb = WHITE; r.font.size = Pt(7); r.font.name = "JetBrains Mono"

# Arrow showing cascade
arrow = slide.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(7.2), Inches(4.4), Inches(0.35), Inches(0.5))
arrow.fill.solid(); arrow.fill.fore_color.rgb = RGBColor(0xF8, 0x71, 0x71); arrow.line.fill.background()

body_textbox(slide, "Outages don't start with a bang — they start with one saturated connection pool that quietly spreads through dependency chains until the whole system is down. CascadeGuard sees that spread before it happens.", Inches(0.8), Inches(6.4), Inches(11.5), Inches(0.7), size=Pt(14), color=SLATE300)
footer(slide)

# ===================================================================
# SLIDE 3 — LIVE PREDICTION (Key metric slide)
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "02  PREDICTION  ·  120 s of actionable warning before the origin service dies")

# Large metric card
rect(slide, Inches(0.8), Inches(2.8), Inches(5.0), Inches(2.6), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "Pool-Exhaustion Scenario", Inches(1.0), Inches(3.0), Inches(4.6), Inches(0.4), size=Pt(13), color=SKY, bold=True)
body_textbox(slide, "120 s", Inches(1.0), Inches(3.4), Inches(4.6), Inches(1.0), size=Pt(64), color=WHITE, bold=True)
body_textbox(slide, "Warning lead time before failure\nPrecision 100% · Recall 100% · 0 missed", Inches(1.0), Inches(4.6), Inches(4.6), Inches(0.7), size=Pt(12), color=SLATE300)

# Side explanation
rect(slide, Inches(6.4), Inches(2.8), Inches(5.8), Inches(2.6), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "How it works", Inches(6.6), Inches(3.0), Inches(5.4), Inches(0.4), size=Pt(13), color=SKY, bold=True)
body_textbox(slide, "A hybrid AI engine reads live telemetry — saturation, error rate, memory, latency — and runs a logistic risk scorer plus dependency-graph propagation. The predictor never sees the ground-truth failure label; it learns only from the telemetry stream. Every prediction is auto-verified against what actually breaks.", Inches(6.6), Inches(3.4), Inches(5.4), Inches(1.9), size=Pt(13), color=SLATE300)

# Prediction ledger preview (visual table)
rounded_rect(slide, Inches(0.8), Inches(5.6), Inches(11.5), Inches(0.9), RGBColor(0x14, 0x1A, 0x2B))
body_textbox(slide, "PREDICTION LEDGER  ·  orders-db · Risk 86% · ✓ HIT · 120 s early  ·  Confirmed at T+03:00  ·  SEV-1 cascade started", Inches(1.0), Inches(5.65), Inches(11.1), Inches(0.7), size=Pt(11), color=WHITE, bold=False)
footer(slide, "LIVE URL: https://cascadeguard-ten.vercel.app/")

# ===================================================================
# SLIDE 4 — ROOT CAUSE TRACE
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "03  ROOT-CAUSE TRACE  ·  Not the loudest failure — the true origin")

# Chain diagram: gateway → orders-api → orders-db
chain_nodes = [
    ("Edge Gateway", Inches(1.5), Inches(2.5), RGBColor(0xF5, 0x9E, 0x0B)),
    ("Orders API", Inches(4.2), Inches(2.5), RGBColor(0x38, 0xBD, 0xF8)),
    ("Orders DB  ✓ ORIGIN", Inches(6.9), Inches(2.5), RGBColor(0xF8, 0x71, 0x71)),
]
for label, x, y, c in chain_nodes:
    circ = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, y, Inches(1.6), Inches(0.7))
    circ.fill.solid(); circ.fill.fore_color.rgb = c; circ.line.fill.background()
    label_box = slide.shapes.add_textbox(x, y + Inches(0.22), Inches(1.6), Inches(0.35))
    tf = label_box.text_frame; tf.word_wrap = False; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    r = tf.paragraphs[0].add_run(); r.text = label; r.font.color.rgb = WHITE; r.font.size = Pt(9); r.font.bold = (label.startswith("Orders DB")); r.font.name = "Inter"
# Arrow between nodes
arrow1 = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(3.2), Inches(2.78), Inches(0.7), Inches(0.15))
arrow1.fill.solid(); arrow1.fill.fore_color.rgb = AMBER; arrow1.line.fill.background()
arrow2 = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(5.9), Inches(2.78), Inches(0.7), Inches(0.15))
arrow2.fill.solid(); arrow2.fill.fore_color.rgb = RGBColor(0xF8, 0x71, 0x71); arrow2.line.fill.background()

body_textbox(slide, "The root-cause analyser combines: temporal precedence (who went wrong first) + self-inflicted severity (own saturation / memory / error rate) + dependency-explained share (is this service's distress explained by an unhealthy dependency?).\n\nAcross all 4 fault scenarios, the true origin is identified with 100% accuracy.", Inches(0.8), Inches(4.0), Inches(11.5), Inches(2.8), size=Pt(14), color=SLATE300)

# Evidence card
rounded_rect(slide, Inches(0.8), Inches(6.0), Inches(11.5), Inches(0.7), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "EVIDENCE  ·  orders-db: saturation 1.30 (baseline 0.62) · error rate 95% (baseline 5%) · evidence from structured server logs · cascade path orders-db → orders-api → inventory-api", Inches(1.0), Inches(6.05), Inches(11.1), Inches(0.6), size=Pt(11), color=WHITE)
footer(slide)

# ===================================================================
# SLIDE 5 — RECOVERY OPTIMIZER
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "04  RECOVERY OPTIMIZER  ·  Monte-Carlo: 30 paired rollouts per strategy")

# Strategy table (simplified)
headers = ["Strategy", "Success %", "New failures", "MTTR", "Cost", "Verdict"]
rows_data = [
    ["failover:orders-db", "100%", "0.0", "12m", "45", "recommended"],
    ["restart:orders-db", "0%", "3.0", "12m", "35", "not-recommended"],
    ["circuit-breaker:orders-db", "0%", "2.6", "12m", "30", "not-recommended"],
    ["no-action", "0%", "3.5", "12m", "0", "not-recommended"],
]
# Build a simple table manually with shapes
x_start = Inches(1.5)
y_start = Inches(3.0)
col_widths = [Inches(3.2), Inches(1.2), Inches(1.2), Inches(1.2), Inches(0.8), Inches(2.0)]
# Header row
for i, (h, w) in enumerate(zip(headers, col_widths)):
    rect(slide, x_start + sum(col_widths[:i]), y_start, w, Inches(0.5), RGBColor(0x1E, 0x29, 0x3B))
    box = slide.shapes.add_textbox(x_start + sum(col_widths[:i]), y_start + Inches(0.05), w, Inches(0.4))
    tf = box.text_frame; tf.word_wrap = False; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    r = tf.paragraphs[0].add_run(); r.text = h; r.font.color.rgb = SKY; r.font.size = Pt(11); r.font.bold = True; r.font.name = "Inter"
# Data rows
for r_idx, row in enumerate(rows_data):
    y_row = y_start + Inches(0.55 + r_idx * 0.55)
    for c_idx, (cell, w) in enumerate(zip(row, col_widths)):
        bg_c = RGBColor(0x11, 0x1C, 0x2E) if r_idx % 2 == 0 else RGBColor(0x0F, 0x12, 0x1A)
        rect(slide, x_start + sum(col_widths[:c_idx]), y_row, w, Inches(0.5), bg_c)
        box = slide.shapes.add_textbox(x_start + sum(col_widths[:c_idx]), y_row + Inches(0.08), w, Inches(0.35))
        tf = box.text_frame; tf.word_wrap = False; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        r = tf.paragraphs[0].add_run()
        r.text = cell; r.font.color.rgb = WHITE if c_idx < 6 else RGBColor(0xF5, 0x9E, 0x0B) if cell == "recommended" else RGBColor(0xF8, 0x71, 0x71) if cell.startswith("not") else SLATE300; r.font.size = Pt(10); r.font.name = "JetBrains Mono"

body_textbox(slide, "Every strategy is replayed against the same 30 random seeds (common random numbers) — the measured lift is attributable to the action, not sampling noise. A strategy is 'recommended' only if it beats the no-action baseline.", Inches(0.55), Inches(6.0), Inches(11.5), Inches(0.8), size=Pt(13), color=SLATE300)
footer(slide)

# ===================================================================
# SLIDE 6 — BUSINESS IMPACT / SLO
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "05  BUSINESS IMPACT  ·  SLO metrics, not just service names")

# Three metric cards side by side
metrics = [
    ("SLO Burn Rate", "11.37×", "Critical threshold exceeded; rapid budget depletion"),
    ("User Flow Degraded", "100%", "All critical user journeys affected by the cascade"),
    ("Revenue at Risk", "$34.2k/min", "Estimated loss rate at time of incident opening"),
]
for i, (label, big, sub) in enumerate(metrics):
    x = Inches(1.0 + i * 4.0)
    rect(slide, x, Inches(2.8), Inches(3.6), Inches(2.6), RGBColor(0x0F, 0x12, 0x1A))
    body_textbox(slide, label, x + Inches(0.2), Inches(3.0), Inches(3.2), Inches(0.4), size=Pt(13), color=SKY, bold=True)
    body_textbox(slide, big, x + Inches(0.2), Inches(3.5), Inches(3.2), Inches(1.0), size=Pt(48), color=WHITE, bold=True)
    body_textbox(slide, sub, x + Inches(0.2), Inches(4.7), Inches(3.2), Inches(0.7), size=Pt(11), color=SLATE300)

# Impact explanation
rounded_rect(slide, Inches(0.55), Inches(5.6), Inches(12.2), Inches(1.3), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "The Impact Panel converts telemetry into what a CTO asks about: which services are down, how much of the user journey is degraded, how fast the SLO budget burns, and the revenue at risk per minute. It draws from the engine's live snapshot — no hand-written estimates.", Inches(0.75), Inches(5.75), Inches(11.8), Inches(1.0), size=Pt(13), color=SLATE300)
footer(slide)

# ===================================================================
# SLIDE 7 — MEASURED BENCHMARKS (The killer metric)
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "06  MEASURED BENCHMARKS  ·  Every number regenerated by the engine")

# Large number grid (4 columns)
big_numbers = [
    ("75 s", "Average warning lead time\n(up to 120 s)"),
    ("100%", "Root-cause origin accuracy\n(4 / 4 scenarios)"),
    ("100%", "Recall — failures caught\n0 missed"),
    ("75%", "Precision (honest: 2 false\nalarms out of 8 predictions)"),
]
for i, (big_text, sub_text) in enumerate(big_numbers):
    x = Inches(1.0 + i * 3.0)
    rect(slide, x, Inches(2.5), Inches(2.8), Inches(2.6), RGBColor(0x0F, 0x12, 0x1A))
    body_textbox(slide, big_text, x, Inches(2.8), Inches(2.8), Inches(1.0), size=Pt(44), color=SKY, bold=True)
    # Center alignment for numbers
    box_sub = slide.shapes.add_textbox(x + Inches(0.2), Inches(3.9), Inches(2.4), Inches(1.0))
    tf = box_sub.text_frame; tf.word_wrap = True; tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    r = tf.paragraphs[0].add_run(); r.text = sub_text; r.font.color.rgb = SLATE300; r.font.size = Pt(11); r.font.name = "Inter"

# Scenario table preview
rounded_rect(slide, Inches(0.55), Inches(5.4), Inches(12.2), Inches(1.0), RGBColor(0x0F, 0x12, 0x1A))
body_textbox(slide, "SCENARIOS  ·  pool-exhaustion  ·  memory-leak  ·  traffic-surge  ·  retry-storm    |    BEST STRATEGIES  ·  failover:orders-db  ·  circuit-breaker:payments-api  ·  restart:orders-db  ·  circuit-breaker:payments-db    |    ALL TARGET THE TRUE ORIGIN", Inches(0.75), Inches(5.5), Inches(11.8), Inches(0.8), size=Pt(10), color=SLATE300)

body_textbox(slide, "Every figure is produced by scripts/evaluate.ts (4 fault scenarios, seed 42, 12 sim-min each) and rendered inside the app's Measured Benchmarks panel — nothing is hand-written.", Inches(0.8), Inches(6.4), Inches(11.5), Inches(0.5), size=Pt(11), color=RGBColor(0x64, 0x74, 0x8B))
footer(slide, "SOURCE: docs/evaluation-report.json · public/evaluation-report.json")

# ===================================================================
# SLIDE 8 — ARCHITECTURE + CLOSING
# ===================================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
bg(slide, VOID)
header_text(slide, "07  ARCHITECTURE  ·  Deterministic twin · Hybrid AI · Fully client-side")

# Three architecture blocks
blocks = [
    ("Digital Twin Engine", "Deterministic mulberry32 PRNG · 9-service topology · 13 dependency edges · 600 ms real tick = 3000 ms sim step · telemetry published every step (speed-invariant)"),
    ("Hybrid AI Stack", "Logistic risk scorer (EWMA trend + slope features) · 2-hop dependency propagation · self-vs-dependency-explained root cause · paired Monte-Carlo recovery (30 rollouts / 7 strategies)"),
    ("Verified Dashboard", "Prediction Ledger (✓ HIT / false-alarm / missed) · Service Deep-Dive drawer (metrics + trends + dependency graph) · Measured Benchmarks · Markdown incident report (⌘E) · keyboard shortcuts"),
]
for i, (title_text, desc_text) in enumerate(blocks):
    x = Inches(0.55 + i * 4.15)
    rect(slide, x, Inches(2.8), Inches(4.0), Inches(3.2), RGBColor(0x14, 0x1A, 0x2B))
    # Title inside the block
    box_t = slide.shapes.add_textbox(x + Inches(0.25), Inches(3.0), Inches(3.5), Inches(0.4))
    tf = box_t.text_frame; tf.word_wrap = False
    r = tf.paragraphs[0].add_run(); r.text = title_text; r.font.color.rgb = SKY; r.font.size = Pt(13); r.font.bold = True; r.font.name = "Inter"
    desc_box = slide.shapes.add_textbox(x + Inches(0.25), Inches(3.5), Inches(3.5), Inches(2.2))
    tf = desc_box.text_frame; tf.word_wrap = True; tf.paragraphs[0].alignment = PP_ALIGN.LEFT
    r = tf.paragraphs[0].add_run(); r.text = desc_text; r.font.color.rgb = SLATE300; r.font.size = Pt(11); r.font.name = "Inter"

# Closing banner
rounded_rect(slide, Inches(0.55), Inches(6.2), Inches(12.2), Inches(0.6), SKY)
body_textbox(slide, "Built for Orcathon 2026  ·  Jay Ghevariya (solo)  ·  GitHub: pal-123456789/cascadeguard  ·  Live: cascadeguard-ten.vercel.app  ·  Fully open source  ·  Predict · Trace · Recover", Inches(0.8), Inches(6.3), Inches(11.8), Inches(0.4), size=Pt(13), color=WHITE, bold=True)

# Save
prs.save("CascadeGuard-Pitch-2min.pptx")
print("Saved CascadeGuard-Pitch-2min.pptx")
