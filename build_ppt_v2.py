#!/usr/bin/env python3
"""Rebuild CascadeGuard pitch with premium aesthetic."""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

# Premium palette — dark editorial / venture-cap aesthetic
BG = RGBColor(0x06, 0x08, 0x12)         # near-black navy
SURFACE = RGBColor(0x0D, 0x11, 0x18)      # subtle card surface
SURFACE2 = RGBColor(0x10, 0x14, 0x1C)     # slightly lighter for contrast
BORDER = RGBColor(0x1A, 0x24, 0x30)       # hairline border
TEXT_PRIMARY = RGBColor(0xF4, 0xF6, 0xF8)  # crisp white
TEXT_SECONDARY = RGBColor(0x94, 0x9C, 0xAE) # cool gray
ACCENT = RGBColor(0x38, 0xD0, 0xF5)        # bright sky blue
ACCENT_DIM = RGBColor(0x1E, 0x6A, 0x8C)   # muted blue for subtle elements
AMBER = RGBColor(0xE8, 0xA8, 0x50)         # warm amber for highlights
RED_WARN = RGBColor(0xF0, 0x5A, 0x6E)     # muted red

FONT_HEAD = "Inter"
FONT_BODY = "Inter"
FONT_MONO = "JetBrains Mono"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def set_bg(slide, c=BG):
    bg = slide.background; f = bg.fill; f.solid(); f.fore_color.rgb = c


def add_shape(slide, kind, left, top, w, h, fill, line_color=None, line_w=Pt(0.75)):
    s = slide.shapes.add_shape(kind, left, top, w, h)
    s.fill.solid(); s.fill.fore_color.rgb = fill
    s.line.color.rgb = line_color if line_color else fill
    s.line.width = line_w
    return s


def add_textbox(slide, left, top, w, h, text, size, bold=False, color=TEXT_PRIMARY,
                 align=PP_ALIGN.LEFT, font=FONT_BODY, word_wrap=True):
    box = slide.shapes.add_textbox(left, top, w, h)
    tf = box.text_frame; tf.word_wrap = word_wrap
    p = tf.paragraphs[0]; p.alignment = align
    r = p.add_run(); r.text = text; r.font.color.rgb = color
    r.font.size = size; r.font.bold = bold; r.font.name = font
    return box


def add_rounded_rect(slide, left, top, w, h, fill, line=BORDER):
    r = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, w, h)
    r.fill.solid(); r.fill.fore_color.rgb = fill
    r.line.color.rgb = line; r.line.width = Pt(0.75)
    r.adjustments[0] = 0.03
    return r


def hairline(slide, left, top, w, color=BORDER):
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, w, Pt(0.5))
    line.fill.solid(); line.fill.fore_color.rgb = color
    line.line.fill.background()
    return line


def corner_badge(slide, left, top, label, bg_color=SURFACE2):
    # Small pill label
    pill = add_rounded_rect(slide, left, top, Inches(2.4), Inches(0.32), bg_color, BORDER)
    add_textbox(slide, left + Inches(0.15), top + Inches(0.02), Inches(2.1), Inches(0.28),
                label, Pt(9), False, TEXT_SECONDARY, align=PP_ALIGN.CENTER, font=FONT_MONO)


def footer_bar(slide, label):
    hairline(slide, Inches(0.5), Inches(7.0), Inches(12.3), BORDER)
    add_textbox(slide, Inches(0.5), Inches(7.08), Inches(6.5), Inches(0.3),
                "ORCATHON 2026  ·  TRACK 01 SOFTWARE & AI  ·  JAY GHEVARIYA (SOLO)",
                Pt(8), False, RGBColor(0x5A, 0x60, 0x70), font=FONT_MONO)
    add_textbox(slide, Inches(8.0), Inches(7.08), Inches(4.5), Inches(0.3),
                label, Pt(8), False, RGBColor(0x7A, 0x82, 0x8F), align=PP_ALIGN.RIGHT, font=FONT_MONO)

# ===================================================================
# SLIDE 1 — TITLE (premium editorial)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)

# Large subtle radial glow behind title
add_shape(s, MSO_SHAPE.OVAL, Inches(8.5), Inches(1.5), Inches(4.5), Inches(3.5),
          RGBColor(0x0D, 0x15, 0x20), line_color=RGBColor(0x14, 0x1A, 0x26))

# Small top-left category pill
corner_badge(s, Inches(0.6), Inches(0.45), "ORCATHON 2026  ·  TRACK 01  SOFTWARE & AI")

# Main title — massive, tight tracking
add_textbox(s, Inches(0.6), Inches(1.7), Inches(11.5), Inches(1.6),
            "CascadeGuard", Pt(80), True, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)
add_textbox(s, Inches(0.6), Inches(3.5), Inches(11.5), Inches(1.0),
            "See the outage before it happens.", Pt(32), False, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)

# Divider
hairline(s, Inches(0.6), Inches(4.7), Inches(5.5), ACCENT_DIM)

# Sub-statement
add_textbox(s, Inches(0.6), Inches(5.05), Inches(10.5), Inches(1.2),
            "A production-grade AI system that predicts cascading software failures, traces root causes, compares recovery strategies with Monte-Carlo simulation, and verifies predictions live against ground truth — fully in your browser.",
            Pt(14), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Bottom evidence row (3 clean stat pills)
for i, (num, desc) in enumerate([
    ("100%", "RECALL  ·  0 MISSED  ·  6 HITS"),
    ("100%", "ORIGIN ACCURACY  ·  4 / 4"),
    ("75 s", "AVG WARNING LEAD  ·  120 s MAX"),
]):
    x = Inches(0.6 + i * 3.95)
    pill = add_rounded_rect(s, x, Inches(6.35), Inches(3.7), Inches(0.75), SURFACE, BORDER)
    add_textbox(s, x + Inches(0.2), Inches(6.42), Inches(1.3), Inches(0.3),
                num, Pt(22), True, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)
    add_textbox(s, x + Inches(1.5), Inches(6.45), Inches(2.0), Inches(0.55),
                desc, Pt(8), False, TEXT_SECONDARY, align=PP_ALIGN.LEFT, font=FONT_MONO)

footer_bar(s, "GITHUB  ·  pal-123456789/cascadeguard  ·  LIVE  ·  cascadeguard-ten.vercel.app")

# ===================================================================
# SLIDE 2 — PROBLEM (editorial, diagram + text split)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "01  ·  THE PROBLEM  ·  DIGITAL TWIN")

# Left: clean topology diagram with geometric precision
# Nodes as small rounded rectangles in a vertical flow (editorial diagram)
ne_nodes = [
    ("edge-gateway", "GATEWAY", Inches(0.7), Inches(2.3), ACCENT),
    ("orders-api", "ORDERS API", Inches(0.7), Inches(3.3), RGBColor(0x3A, 0x56, 0x6E)),
    ("orders-db", "ORDERS DB  ·  FAILING", Inches(0.7), Inches(4.3), RED_WARN),
    ("inventory-api", "INVENTORY API", Inches(3.8), Inches(3.0), RGBColor(0x3A, 0x56, 0x6E)),
    ("payments-api", "PAYMENTS API", Inches(0.7), Inches(5.3), RGBColor(0x3A, 0x56, 0x6E)),
]
for name, label, x, y, c in ne_nodes:
    # Card
    card = add_rounded_rect(s, x, y, Inches(2.7), Inches(0.55), SURFACE, BORDER)
    # Small colored left strip
    add_shape(s, MSO_SHAPE.RECTANGLE, x, y, Inches(0.05), Inches(0.55), c)
    add_textbox(s, x + Inches(0.2), y + Inches(0.08), Inches(2.3), Inches(0.2),
                label, Pt(9), True, c == RED_WARN and TEXT_PRIMARY or (c == ACCENT and BG) or TEXT_PRIMARY,
                PP_ALIGN.LEFT, FONT_MONO)

# Arrow showing cascade direction (downward red arrow near DB)
arrow_shape = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(3.2), Inches(4.5), Inches(0.35), Inches(0.7))
arrow_shape.fill.solid(); arrow_shape.fill.fore_color.rgb = RED_WARN
arrow_shape.line.fill.background()

# Right: editorial text explanation
add_textbox(s, Inches(4.6), Inches(2.3), Inches(7.8), Inches(0.9),
            "A live digital twin of a 9-service e-commerce cluster.", Pt(28), True, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)
add_textbox(s, Inches(4.6), Inches(3.3), Inches(7.8), Inches(2.5),
            "The gateway feeds APIs; APIs call databases and a cache. When Orders DB's connection pool exhausts, a retry storm amplifies upstream — gateway degradation, orders-api saturation, inventory-api error spike. The cascade isn't a sequence of independent alerts; it's a single failure propagating through a dependency graph. CascadeGuard doesn't watch for symptoms. It predicts the origin.",
            Pt(14), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Callout card at bottom
add_rounded_rect(s, Inches(4.6), Inches(5.9), Inches(7.8), Inches(0.95), SURFACE, BORDER)
add_textbox(s, Inches(4.8), Inches(6.05), Inches(7.4), Inches(0.35),
            "13 dependency edges  ·  9 services  ·  4 fault scenarios  ·  deterministic seed 42",
            Pt(11), False, ACCENT, PP_ALIGN.LEFT, FONT_MONO)
add_textbox(s, Inches(4.8), Inches(6.45), Inches(7.4), Inches(0.32),
            "Every service, edge weight and capacity is defined in src/core/engine/topology — no synthetic approximation.",
            Pt(10), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

footer_bar(s, "SCENARIO  ·  CONNECTION POOL EXHAUSTION  ·  LIVE  ·  cascadeguard-ten.vercel.app")

# ===================================================================
# SLIDE 3 — PREDICTION (editorial with metric dominance)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "02  ·  PREDICTION  ·  HYBRID AI  ·  120 s LEAD")

# Dominant metric: huge number centered-left
add_textbox(s, Inches(0.6), Inches(1.6), Inches(5.5), Inches(2.0),
            "120 s", Pt(120), True, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)
add_textbox(s, Inches(0.6), Inches(3.6), Inches(5.5), Inches(0.8),
            "WARNING LEAD TIME  ·  BEFORE ORIGIN SERVICE FAILS  ·  SCENARIO: POOL-EXHAUSTION",
            Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_MONO)

# Divider between metric and explanation
add_shape(s, MSO_SHAPE.RECTANGLE, Inches(6.0), Inches(1.8), Inches(0.02), Inches(5.0), BORDER)

# Explanation text (clean, editorial)
add_textbox(s, Inches(6.3), Inches(1.8), Inches(6.4), Inches(2.4),
            "How it predicts", Pt(24), True, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)

bullets = [
    "Logistic risk scorer: 11 weighted signals (memory, saturation, error rate, CPU, p99 latency, EWMA slope trends, log burst).",
    "2-hop dependency-graph propagation: risk flows through edges with decay (PROP_GAIN = 0.3).",
    "Self-vs-dependency-explained root-cause scoring: origins score higher than victims.",
    "Time-based trend window (120 s): speed-invariant at 1×, 2×, 4× or 20× playback.",
    "Kind-sensitive risk scaling: database 1.2×, queue 1.15×, gateway 0.95×."
]
for i, b in enumerate(bullets):
    y = Inches(3.3 + i * 0.55)
    # Small bullet dot
    dot = add_shape(s, MSO_SHAPE.OVAL, Inches(6.3), y + Inches(0.18), Inches(0.1), Inches(0.1), ACCENT)
    add_textbox(s, Inches(6.55), y, Inches(6.0), Inches(0.45),
                b, Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Bottom stat row (3 clean numbers)
stats = [
    ("120 s", "BEST CONFIRMED LEAD"),
    ("0", "MISSED FAILURES"),
    ("100%", "RECALL  ·  6 HITS"),
]
for i, (n, d) in enumerate(stats):
    x = Inches(0.6 + i * 3.9)
    pill = add_rounded_rect(s, x, Inches(6.0), Inches(3.7), Inches(0.7), SURFACE, BORDER)
    add_textbox(s, x + Inches(0.2), Inches(6.12), Inches(1.2), Inches(0.3),
                n, Pt(22), True, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)
    add_textbox(s, x + Inches(1.4), Inches(6.15), Inches(2.2), Inches(0.4),
                d, Pt(9), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_MONO)

footer_bar(s, "VERIFIED  ·  scripts/evaluate.ts  ·  docs/evaluation-report.json  ·  SEED 42  ·  12 SIM-MIN")

# ===================================================================
# SLIDE 4 — ROOT CAUSE (editorial chain diagram)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "03  ·  ROOT CAUSE  ·  SELF-INFLICTED VS DEPENDENCY-EXPLAINED")

# Chain: gateway → orders-api → orders-db (visual chain with clear direction)
# Horizontal chain with nodes and arrows
chain_items = [
    ("Edge Gateway", RGBColor(0xE8, 0xA8, 0x50)),
    ("Orders API", RGBColor(0x3A, 0x56, 0x6E)),
    ("Orders DB  ·  ORIGIN", RED_WARN),
]
start_x = Inches(1.0)
for i, (label, c) in enumerate(chain_items):
    cx = start_x + i * Inches(3.2)
    # Card
    card = add_rounded_rect(s, cx, Inches(2.5), Inches(2.8), Inches(1.0), SURFACE, BORDER)
    # Left accent strip
    add_shape(s, MSO_SHAPE.RECTANGLE, cx, Inches(2.5), Inches(0.06), Inches(1.0), c)
    # Label
    lbl_color = BG if c == RED_WARN else TEXT_PRIMARY  # white on dark fine
    add_textbox(s, cx + Inches(0.15), Inches(2.7), Inches(2.5), Inches(0.3),
                label, Pt(12), True, lbl_color, PP_ALIGN.CENTER, FONT_HEAD)
    # Sub-metric under card
    sub = "SAT: 0.56  ·  ERR: 10%" if i == 0 else ("SAT: 0.34  ·  ERR: 48%" if i == 1 else "SAT: 1.30  ·  ERR: 95%  ·  CONFIDENCE: 95%")
    add_textbox(s, cx + Inches(0.15), Inches(3.55), Inches(2.5), Inches(0.25),
                sub, Pt(8), False, c == RED_WARN and AMBER or ACCENT_DIM, PP_ALIGN.CENTER, FONT_MONO)
    # Arrow between cards (except last)
    if i < 2:
        arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, cx + Inches(2.75), Inches(2.95), Inches(0.45), Inches(0.15))
        arrow.fill.solid(); arrow.fill.fore_color.rgb = (RED_WARN if c == RED_WARN else (ACCENT if i == 0 else RED_WARN)); arrow.line.fill.background()

# Explanation (editorial, right-aligned under chain)
add_textbox(s, Inches(0.6), Inches(4.7), Inches(11.8), Inches(0.8),
            "The root-cause analyser compares self-inflicted severity (service's own saturation, memory, error rate) against dependency-explained share (how much of its error is explained by unhealthy upstream dependencies). The true origin degrades independently — the victim inherits it.",
            Pt(13), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Key result banner
add_rounded_rect(s, Inches(0.6), Inches(5.7), Inches(11.8), Inches(0.9), SURFACE, BORDER)
add_textbox(s, Inches(0.8), Inches(5.85), Inches(5.5), Inches(0.6),
            "100% ORIGIN ACCURACY  ·  4 / 4 SCENARIOS", Pt(18), True, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)
add_textbox(s, Inches(6.5), Inches(5.95), Inches(6.5), Inches(0.45),
            "Predicted origins: orders-db · payments-api · orders-db · payments-db  ·  All match ground truth exactly.",
            Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

footer_bar(s, "METHOD  ·  BASELINE (10th PERCENTILE)  ·  DEPENDENCY-EXPLAINED SHARE  ·  PATH STRENGTH (DFS ≤ 4 HOPS)")

# ===================================================================
# SLIDE 5 — RECOVERY (editorial table + verdict explanation)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "04  ·  RECOVERY  ·  MONTE-CARLO OPTIMIZER")

# Title and subtitle
add_textbox(s, Inches(0.6), Inches(1.3), Inches(12.0), Inches(0.6),
            "Seven strategies · 30 paired rollouts · common random numbers · verdict by baseline comparison",
            Pt(22), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Clean table (editorial style — no heavy borders, light separators)
# Columns: Strategy | Success % | Cascade size | Damage | MTTR | Verdict
headers = ["STRATEGY", "SUCCESS %", "NEW FAILURES", "DAMAGE", "MTTR", "VERDICT"]
rows = [
    ["failover:orders-db", "100%", "0.0", "0.0", "12m", "RECOMMENDED"],
    ["circuit-breaker:orders-db", "0%", "2.6", "128.0", "12m", "NOT RECOMMENDED"],
    ["restart:orders-db", "0%", "3.0", "401.0", "12m", "NOT RECOMMENDED"],
    ["shed-load:gateway", "0%", "3.6", "158.0", "12m", "NOT RECOMMENDED"],
    ["no-action", "0%", "3.5", "155.0", "12m", "NOT RECOMMENDED"],
]

# Header row
for i, (h, w_frac) in enumerate(zip(headers, [0.28, 0.10, 0.14, 0.10, 0.08, 0.22])):
    x = Inches(0.6 + i * 2.0)
    w = Inches(2.0) if i < 5 else Inches(1.8)
    add_shape(s, MSO_SHAPE.RECTANGLE, x, Inches(2.3), w, Inches(0.45), SURFACE2)
    add_textbox(s, x + Inches(0.05), Inches(2.33), w - Inches(0.1), Inches(0.4),
                h, Pt(8), True, ACCENT, PP_ALIGN.LEFT, FONT_MONO)

# Data rows (4 rows max for readability)
for r_idx, row in enumerate(rows):
    y = Inches(2.8 + r_idx * 0.55)
    for i, val in enumerate(row):
        x = Inches(0.6 + i * 2.0)
        w = Inches(2.0) if i < 5 else Inches(1.8)
        # Verdict column gets special coloring
        is_rec = val == "RECOMMENDED"
        is_not = val.startswith("NOT")
        text_color = (ACCENT if is_rec else (RED_WARN if is_not else TEXT_PRIMARY))
        add_shape(s, MSO_SHAPE.RECTANGLE, x, y, w, Inches(0.48), SURFACE if r_idx % 2 == 0 else SURFACE2)
        # Thin left indicator for recommended
        if is_rec:
            add_shape(s, MSO_SHAPE.RECTANGLE, x, y, Inches(0.03), Inches(0.48), ACCENT)
        add_textbox(s, x + Inches(0.1), y + Inches(0.08), w - Inches(0.1), Inches(0.32),
                    val, Pt(10), True, text_color, PP_ALIGN.LEFT, FONT_MONO)

# Explanation text
add_textbox(s, Inches(0.6), Inches(5.6), Inches(12.0), Inches(0.7),
            "Paired common-random-number rollouts mean the measured lift (recommended vs not-recommended) is attributable to the action — not random noise. A strategy is 'recommended' only if it beats the no-action baseline (success ≥ 50% + positive lift).",
            Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Bottom note
add_textbox(s, Inches(0.6), Inches(6.25), Inches(12.0), Inches(0.3),
            "ABSTRACT MODEL  ·  DEMAND FLOWS TOPOLOGICALLY  ·  SPILLOVER + RETRY PRESSURE  ·  144 STEPS (12 MIN)  ·  5 s / STEP",
            Pt(8), False, RGBColor(0x5A, 0x60, 0x70), PP_ALIGN.LEFT, FONT_MONO)

footer_bar(s, "SCENARIO  ·  POOL-EXHAUSTION  ·  30 ROLLOUTS  ·  SEED 42  ·  PAID BASELINE SHARED ACROSS ALL STRATEGIES")

# ===================================================================
# SLIDE 6 — BUSINESS IMPACT (editorial 3-card layout)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "05  ·  BUSINESS IMPACT  ·  SLO METRICS  ·  NOT SERVICE NAMES")

# Title
add_textbox(s, Inches(0.6), Inches(1.3), Inches(12.0), Inches(0.8),
            "What a CTO asks about — converted live from telemetry into business language",
            Pt(24), False, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)

# Three large cards
cards = [
    ("SLO BURN RATE", "11.37×", "Critical threshold exceeded rapidly. Budget depletion accelerates as unhealthy services accumulate.", ACCENT),
    ("USER FLOW DEGRADED", "100%", "Every critical user journey affected by the cascading failure originating at Orders DB.", AMBER),
    ("REVENUE AT RISK", "$34.2k / min", "Estimated loss rate at time of incident opening — computed live from service criticality weights.", RED_WARN),
]
for i, (label, num, desc, accent_c) in enumerate(cards):
    x = Inches(0.6 + i * 4.1)
    card = add_rounded_rect(s, x, Inches(2.4), Inches(3.9), Inches(3.2), SURFACE, BORDER)
    # Small colored top strip
    add_shape(s, MSO_SHAPE.RECTANGLE, x, Inches(2.4), Inches(3.9), Inches(0.04), accent_c)
    add_textbox(s, x + Inches(0.25), Inches(2.7), Inches(3.4), Inches(0.35),
                label, Pt(10), False, accent_c, PP_ALIGN.LEFT, FONT_MONO)
    add_textbox(s, x + Inches(0.25), Inches(3.1), Inches(3.4), Inches(1.0),
                num, Pt(36), True, accent_c, PP_ALIGN.LEFT, FONT_HEAD)
    add_textbox(s, x + Inches(0.25), Inches(4.25), Inches(3.4), Inches(1.0),
                desc, Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)
    # Small indicator pill at bottom of card
    indicator = "COMPUTED LIVE FROM ENGINE SNAPSHOT" if i == 2 else ("DERIVED FROM SERVICE STATUS" if i == 1 else "DERIVED FROM SLO THRESHOLD COMPARISON")
    add_textbox(s, x + Inches(0.25), Inches(5.7), Inches(3.4), Inches(0.3),
                indicator, Pt(8), False, RGBColor(0x5A, 0x60, 0x70), PP_ALIGN.LEFT, FONT_MONO)

# Bottom note
add_rounded_rect(s, Inches(0.6), Inches(6.65), Inches(12.1), Inches(0.55), SURFACE, BORDER)
add_textbox(s, Inches(0.8), Inches(6.75), Inches(11.7), Inches(0.35),
            "IMPACT PANEL  ·  SEVERITY: CRITICAL (5+ AFFECTED SERVICES)  ·  COMPUTED FROM snap.metrics  ·  NO HAND-WRITTEN ESTIMATES",
            Pt(9), False, ACCENT_DIM, PP_ALIGN.LEFT, FONT_MONO)

footer_bar(s, "SCENARIO  ·  POOL-EXHAUSTION  ·  SEVERITY: CRITICAL  ·  AFFECTED SERVICES: 4")

# ===================================================================
# SLIDE 7 — BENCHMARKS (editorial, metric grid + scenario table)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "06  ·  MEASURED BENCHMARKS  ·  REGENERATED BY ENGINE")

add_textbox(s, Inches(0.6), Inches(1.3), Inches(12.0), Inches(0.6),
            "Every figure below is produced by scripts/evaluate.ts — 4 scenarios, seed 42, 12 sim-min each — and rendered live in the dashboard.",
            Pt(16), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Four big metric tiles (editorial grid)
metrics = [
    ("75 s", "AVERAGE WARNING LEAD TIME", "Up to 120 s in the flagship pool-exhaustion scenario."),
    ("100%", "ORIGIN ACCURACY", "True origin identified correctly across all 4 fault scenarios."),
    ("100%", "RECALL  ·  6 HITS  ·  0 MISSED", "Every failure was predicted before it occurred — no false negatives."),
    ("75%", "PRECISION  ·  HONEST REPORTING", "2 false alarms out of 8 predictions — reported, not smoothed away."),
]
for i, (num, label, desc) in enumerate(metrics):
    x = Inches(0.6 + i * 3.05)
    tile = add_rounded_rect(s, x, Inches(2.2), Inches(2.9), Inches(2.8), SURFACE, BORDER)
    # Thin top accent line
    add_shape(s, MSO_SHAPE.RECTANGLE, x, Inches(2.2), Inches(2.9), Inches(0.04), ACCENT)
    add_textbox(s, x + Inches(0.2), Inches(2.45), Inches(2.5), Inches(0.9),
                num, Pt(36), True, ACCENT, PP_ALIGN.LEFT, FONT_HEAD)
    add_textbox(s, x + Inches(0.2), Inches(3.4), Inches(2.5), Inches(0.7),
                label, Pt(9), False, ACCENT, PP_ALIGN.LEFT, FONT_MONO)
    add_textbox(s, x + Inches(0.2), Inches(4.0), Inches(2.5), Inches(0.9),
                desc, Pt(10), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Scenario summary bar (editorial — clean horizontal row of pills)
add_rounded_rect(s, Inches(0.6), Inches(5.3), Inches(12.1), Inches(0.9), SURFACE2, BORDER)
# Four scenario pills
scenarios_text = "POOL-EXHAUSTION  ·  MEMORY-LEAK  ·  TRAFFIC-SURGE  ·  RETRY-STORM"
add_textbox(s, Inches(0.9), Inches(5.5), Inches(5.0), Inches(0.3),
            scenarios_text, Pt(10), False, ACCENT, PP_ALIGN.LEFT, FONT_MONO)
# Key results pill
results_text = "AVG LEAD: 75 s  ·  ORIGIN ACC: 100%  ·  PRECISION: 75%  ·  RECALL: 100%  ·  HITS: 6  ·  MISSED: 0"
add_textbox(s, Inches(0.9), Inches(5.8), Inches(11.5), Inches(0.3),
            results_text, Pt(9), False, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_MONO)

# Source attribution
add_textbox(s, Inches(0.9), Inches(6.35), Inches(7.0), Inches(0.3),
            "SOURCE  ·  docs/evaluation-report.json  ·  public/evaluation-report.json  ·  SEED 42  ·  4 SCENARIOS  ·  12 SIM-MIN EACH",
            Pt(8), False, RGBColor(0x5A, 0x60, 0x70), PP_ALIGN.LEFT, FONT_MONO)

footer_bar(s, "VERIFIED HEADLESS  ·  scripts/evaluate.ts  ·  NO HAND-WRITTEN NUMBERS")

# ===================================================================
# SLIDE 8 — ARCHITECTURE + CLOSE (editorial, 3 blocks + closing banner)
# ===================================================================
s = prs.slides.add_slide(prs.slide_layouts[6])
set_bg(s)
corner_badge(s, Inches(0.6), Inches(0.4), "07  ·  ARCHITECTURE  ·  FULLY CLIENT-SIDE  ·  NO BACKEND")

add_textbox(s, Inches(0.6), Inches(1.2), Inches(12.0), Inches(0.7),
            "Deterministic twin · Hybrid AI · Verified dashboard",
            Pt(28), False, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)

# Three architecture cards (editorial, clean typography, no clutter)
blocks = [
    ("01", "DETERMINISTIC ENGINE",
     "Seeded mulberry32 PRNG. 9 services · 13 dependency edges · 600 ms real tick = 3000 ms sim step. Telemetry published every simulation step — speed-invariant EWMA trend features.",
     ACCENT),
    ("02", "HYBRID AI STACK",
     "Logistic risk scorer (EWMA + slope features) · 2-hop graph propagation · self-vs-dependency-explained root-cause scoring · paired Monte-Carlo recovery (30 rollouts / 7 strategies).",
     RGBColor(0x34, 0xD3, 0x99)),
    ("03", "VERIFIED DASHBOARD",
     "Prediction Ledger (✓ HIT / false-alarm / missed) · Service Deep-Dive drawer (metrics + trends + dependency graph) · Measured Benchmarks · Markdown incident report · keyboard shortcuts.",
     AMBER),
]
for i, (num, title, desc, accent_c) in enumerate(blocks):
    x = Inches(0.6 + i * 4.05)
    card = add_rounded_rect(s, x, Inches(2.2), Inches(3.85), Inches(3.2), SURFACE, BORDER)
    # Number circle
    circ = add_shape(s, MSO_SHAPE.OVAL, x + Inches(0.25), Inches(2.45), Inches(0.65), Inches(0.65), accent_c)
    add_textbox(s, x + Inches(0.25), Inches(2.58), Inches(0.65), Inches(0.4),
                num, Pt(14), True, BG, PP_ALIGN.CENTER, FONT_HEAD)
    add_textbox(s, x + Inches(1.0), Inches(2.45), Inches(2.7), Inches(0.8),
                title, Pt(14), True, TEXT_PRIMARY, PP_ALIGN.LEFT, FONT_HEAD)
    hairline(s, x + Inches(0.25), Inches(3.35), Inches(3.35), BORDER)
    add_textbox(s, x + Inches(0.25), Inches(3.5), Inches(3.4), Inches(1.8),
                desc, Pt(11), False, TEXT_SECONDARY, PP_ALIGN.LEFT, FONT_BODY)

# Closing banner (premium — large, clean, authoritative)
banner = add_rounded_rect(s, Inches(0.6), Inches(5.7), Inches(12.1), Inches(1.1), SURFACE2, BORDER)
add_textbox(s, Inches(0.8), Inches(5.9), Inches(11.5), Inches(0.6),
            "Predict · Trace · Recover  ·  Fully open source  ·  Live: cascadeguard-ten.vercel.app  ·  GitHub: pal-123456789/cascadeguard  ·  Built for Orcathon 2026 · Jay Ghevariya (solo)",
            Pt(14), False, TEXT_PRIMARY, PP_ALIGN.CENTER, FONT_HEAD)

# Sub-caption
add_textbox(s, Inches(0.8), Inches(6.55), Inches(11.5), Inches(0.3),
            "Every claim verified by the engine's own ground truth · Every number regenerated by scripts/evaluate.ts · No black-box AI · No hand-written estimates",
            Pt(10), False, ACCENT_DIM, PP_ALIGN.CENTER, FONT_MONO)

footer_bar(s, "TYPECHECK: CLEAN  ·  SMOKE: ALL PASS  ·  BUILD: 436 ms  ·  DEPLOY: VERCEL  ·  VIDEO: 3-MIN DEMO READY")

# ===================================================================
# SAVE
# ===================================================================
prs.save("CascadeGuard-Pitch-2min-v2.pptx")
print("Saved CascadeGuard-Pitch-2min-v2.pptx")
