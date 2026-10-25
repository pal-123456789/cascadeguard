from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR

OUT = Path("/mnt/data")
ppt_path = OUT / "CascadeGuard-Professional-Pitch.pptx"
py_path = OUT / "build_ppt_professional.py"

BG=RGBColor(8,14,27); PANEL=RGBColor(15,25,43); ALT=RGBColor(19,33,54)
BORDER=RGBColor(36,54,78); CYAN=RGBColor(67,210,255); MINT=RGBColor(93,231,184)
AMBER=RGBColor(255,190,92); CORAL=RGBColor(255,112,126); WHITE=RGBColor(241,247,255)
MUTED=RGBColor(159,178,202); DIM=RGBColor(104,126,153); FONT="Aptos"; MONO="Aptos Mono"

def build_deck(path):
    prs=Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5); blank=prs.slide_layouts[6]
    def bg(s):
        s.background.fill.solid(); s.background.fill.fore_color.rgb=BG
    def sh(s, kind, x,y,w,h,fill,linec=None):
        z=s.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
        z.fill.solid(); z.fill.fore_color.rgb=fill; z.line.color.rgb=linec or fill
        if kind==MSO_SHAPE.ROUNDED_RECTANGLE:
            try: z.adjustments[0]=0.06
            except: pass
        return z
    def tx(s,text,x,y,w,h,size=14,color=WHITE,bold=False,font=FONT,align=PP_ALIGN.LEFT,valign=MSO_ANCHOR.TOP,italic=False):
        z=s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); tf=z.text_frame; tf.clear(); tf.word_wrap=True
        tf.margin_left=tf.margin_right=Inches(0); tf.margin_top=tf.margin_bottom=Inches(0); tf.vertical_anchor=valign
        p=tf.paragraphs[0]; p.alignment=align
        r=p.add_run(); r.text=text; r.font.name=font; r.font.size=Pt(size); r.font.bold=bold; r.font.italic=italic; r.font.color.rgb=color
        return z
    def ln(s,x1,y1,x2,y2,c=BORDER,width=1.3):
        z=s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2)); z.line.color.rgb=c; z.line.width=Pt(width); return z
    def card(s,x,y,w,h,c=PANEL):
        sh(s,MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,h,c,BORDER)
    def pill(s,text,x,y,w,c=CYAN,fill=ALT):
        sh(s,MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,.34,fill,fill)
        tx(s,text,x+.06,y+.035,w-.12,.23,8,c,True,MONO,PP_ALIGN.CENTER,MSO_ANCHOR.MIDDLE)
    def header(s,tag,title,sub,n):
        tx(s,tag.upper(),.68,.32,10,.24,9,CYAN,True,MONO)
        tx(s,title,.68,.75,12,.56,27,WHITE,True)
        tx(s,sub,.7,1.39,11.8,.42,12,MUTED)
        tx(s,f"{n:02d}",12.1,.32,.5,.25,10,DIM,True,MONO,PP_ALIGN.RIGHT)
    def footer(s):
        ln(s,.68,7.08,12.65,7.08,BORDER,.8)
        tx(s,"CASCADEGUARD  /  ORCATHON 2026",.7,7.16,6,.18,8,DIM,True,MONO)
        tx(s,"PREDICT  ·  TRACE  ·  RECOVER",9.2,7.16,3.4,.18,8,DIM,True,MONO,PP_ALIGN.RIGHT)
    def node(s,x,y,label,c=CYAN,w=1.6):
        sh(s,MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,.52,ALT,c)
        sh(s,MSO_SHAPE.OVAL,x+.12,y+.17,.16,.16,c,c)
        tx(s,label,x+.36,y+.08,w-.43,.32,9,WHITE,True,valign=MSO_ANCHOR.MIDDLE)
    def metric(s,x,y,w,value,label,c,note):
        card(s,x,y,w,1.52)
        tx(s,value,x+.22,y+.18,w-.4,.58,27,c,True)
        tx(s,label,x+.22,y+.82,w-.4,.3,11,WHITE,True)
        tx(s,note,x+.22,y+1.17,w-.4,.2,8,MUTED)

    # Cover
    s=prs.slides.add_slide(blank); bg(s); sh(s,MSO_SHAPE.RECTANGLE,0,0,.12,7.5,CYAN,CYAN)
    for x,y,r,c in [(9.1,1.15,.18,CYAN),(10.55,1.85,.23,MINT),(12,1.25,.15,CYAN),(9.7,3.05,.18,AMBER),(11.25,3.5,.23,CORAL),(12.1,4.55,.15,CYAN),(10.15,4.6,.18,MINT),(8.8,4.25,.14,CYAN)]:
        sh(s,MSO_SHAPE.OVAL,x,y,r,r,c,c)
    for a,b in [((9.2,1.25),(10.65,1.95)),((10.65,1.95),(12.08,1.32)),((10.65,1.95),(9.8,3.15)),((9.8,3.15),(11.35,3.6)),((11.35,3.6),(12.16,4.62)),((9.8,3.15),(10.24,4.68)),((10.24,4.68),(11.35,3.6)),((8.87,4.32),(9.8,3.15))]: ln(s,*a,*b)
    pill(s,"ORCATHON 2026  •  SOFTWARE & AI",.8,.82,2.95)
    tx(s,"Cascade",.8,1.68,6.6,.9,52,WHITE,True); tx(s,"Guard",.8,2.52,6.6,.9,52,CYAN,True)
    tx(s,"See the outage before it happens.",.84,3.62,7.2,.48,21,WHITE,True)
    tx(s,"A simulation-first resilience workbench to predict cascading failures,\ntrace likely origins, and compare recovery strategies.",.84,4.34,7.3,.82,15,MUTED)
    ln(s,.84,5.55,6.9,5.55)
    tx(s,"PAL GHEVARIYA  /  SOLO PROJECT",.84,5.82,5.7,.25,10,MUTED,True,MONO)
    tx(s,"GitHub  github.com/pal-123456789/cascadeguard",.84,6.2,7.1,.25,10,DIM,False,MONO)
    tx(s,"LIVE DEMO",9.25,5.42,1.5,.22,9,CYAN,True,MONO); tx(s,"cascadeguard-ten.vercel.app",9.25,5.75,3.2,.3,11,WHITE,True)
    footer(s)

    # Problem
    s=prs.slides.add_slide(blank); bg(s); header(s,"01 / THE CHALLENGE","One failing service can take down the whole journey","Cascading failures are difficult to diagnose when dependencies amplify symptoms.",2)
    card(s,.72,2.05,7.25,4.5); tx(s,"DEPENDENCY MAP  /  SIMULATED E-COMMERCE",1,2.32,5.7,.23,9,DIM,True,MONO)
    node(s,3.52,2.85,"Edge gateway",AMBER,1.72); node(s,1.25,4,"Auth service",MINT,1.62); node(s,3.52,4,"Orders API",CYAN,1.62); node(s,5.78,4,"Inventory API",CYAN,1.72); node(s,3.52,5.18,"Orders DB",CORAL,1.62); node(s,1.25,5.18,"Payments API",MINT,1.62); node(s,5.78,5.18,"Redis cache",AMBER,1.62)
    ln(s,4.25,3.37,2.05,4); ln(s,4.35,3.37,4.28,4,CYAN,2); ln(s,4.7,3.37,6.55,4); ln(s,4.25,4.52,4.25,5.18,CORAL,2); ln(s,3.52,4.28,2.87,5.18); ln(s,5.14,4.28,5.78,5.18)
    pill(s,"ORIGIN",5.55,5.82,.86,CORAL,RGBColor(57,25,38))
    card(s,8.28,2.05,4.3,4.5,ALT); tx(s,"THE OPERATIONAL GAP",8.62,2.4,3.5,.25,9,CYAN,True,MONO)
    for i,(n,t,d) in enumerate([("01","Late detection","Alerts often arrive after impact spreads."),("02","Ambiguous origin","The loudest symptom may not be the root cause."),("03","Unproven response","Compare actions before applying them.")]):
        yy=2.95+i*1.08; tx(s,n,8.62,yy,.45,.3,12,AMBER,True,MONO); tx(s,t,9.2,yy,2.8,.3,13,WHITE,True); tx(s,d,9.2,yy+.35,2.85,.5,10,MUTED)
    footer(s)

    # Workflow
    s=prs.slides.add_slide(blank); bg(s); header(s,"02 / THE APPROACH","From telemetry to a tested recovery decision","Four connected steps in one simulation-driven workflow.",3)
    steps=[("01","SIMULATE","Generate telemetry and\ncontrolled fault scenarios.",CYAN),("02","PREDICT","Score risk from trends and\npropagate it over dependencies.",MINT),("03","TRACE","Rank likely origins using\nprecedence and service evidence.",AMBER),("04","COMPARE","Replay recovery options and\ncompare with no action.",CORAL)]
    for i,(num,title,desc,c) in enumerate(steps):
        x=.75+i*3.16; card(s,x,2.55,2.75,2.55); pill(s,num,x+.22,2.82,.58,c); tx(s,title,x+.22,3.45,2.3,.38,16,WHITE,True); tx(s,desc,x+.22,4.05,2.25,.72,11,MUTED)
        if i<3: ln(s,x+2.78,3.8,x+3.12,3.8,c,2)
    card(s,.75,5.55,11.83,.86,ALT); tx(s,"DESIGN PRINCIPLE",1.02,5.78,1.65,.22,9,CYAN,True,MONO); tx(s,"Predictions are checked against simulated outcomes; recommendations are compared with a baseline.",2.75,5.72,9.25,.35,13,WHITE,True)
    footer(s)

    # Prediction
    s=prs.slides.add_slide(blank); bg(s); header(s,"03 / PREDICT","Risk signals before the failure point","Telemetry trends and dependency-aware risk propagation help surface warning signals.",4)
    card(s,.75,2.15,4.15,3.95); tx(s,"MEASURED BENCHMARKS",1.05,2.45,3.2,.24,9,DIM,True,MONO); tx(s,"75 s",1.05,2.95,3.3,.8,43,CYAN,True); tx(s,"Average warning lead time",1.05,3.78,3.25,.32,13,WHITE,True); tx(s,"Up to 120 s in the pool-exhaustion scenario.",1.05,4.24,3.3,.55,10,MUTED); ln(s,1.05,5.1,4.48,5.1); tx(s,"Simulation result • seed 42",1.05,5.35,3.3,.24,9,DIM,False,MONO)
    card(s,5.25,2.15,7.3,3.95); tx(s,"WHAT THE ENGINE USES",5.62,2.45,4,.24,9,CYAN,True,MONO)
    for i,(title,desc,c) in enumerate([("Trend features","EWMA trend and slope across telemetry.",CYAN),("Risk score","Logistic scorer evaluates observed signals.",MINT),("Dependency propagation","Two-hop graph propagation estimates downstream risk.",AMBER),("Outcome verification","Ledger records hits, false alarms and missed events.",CORAL)]):
        yy=2.95+i*.7; sh(s,MSO_SHAPE.OVAL,5.64,yy+.04,.17,.17,c,c); tx(s,title,5.96,yy,2.35,.28,11,WHITE,True); tx(s,desc,8.28,yy,3.8,.42,10,MUTED)
    pill(s,"REPORTED: 100% RECALL",5.62,5.72,2.12,MINT,RGBColor(17,47,48)); pill(s,"REPORTED: 75% PRECISION",7.9,5.72,2.3,AMBER,RGBColor(49,36,23)); tx(s,"Simulation benchmark only—not a production outage guarantee.",5.62,6.14,6.35,.25,9,DIM,False,italic=True)
    footer(s)

    # Root cause
    s=prs.slides.add_slide(blank); bg(s); header(s,"04 / TRACE","Find the likely origin—not just the loudest symptom","Root-cause ranking combines time order, local severity and dependency context.",5)
    card(s,.75,2.18,7.25,3.95); node(s,1.18,3,"Edge gateway",AMBER,1.75); node(s,3.45,3,"Orders API",CYAN,1.65); node(s,5.62,3,"Orders DB",CORAL,1.7); ln(s,2.94,3.26,3.43,3.26,AMBER,2); ln(s,5.1,3.26,5.6,3.26,CORAL,2)
    tx(s,"DOWNSTREAM SYMPTOM",1.22,4.02,2.4,.22,9,DIM,True,MONO); tx(s,"Orders API latency rises",1.22,4.36,2.4,.3,12,WHITE,True); tx(s,"LIKELY ORIGIN",4.15,4.02,1.8,.22,9,CORAL,True,MONO); tx(s,"Orders DB saturation",4.15,4.36,2.6,.3,12,WHITE,True); tx(s,"Illustrative failure chain",1.22,5.45,4.3,.25,9,DIM,False,italic=True)
    card(s,8.3,2.18,4.25,3.95,ALT); tx(s,"EVIDENCE LENSES",8.65,2.52,3.1,.25,9,CYAN,True,MONO)
    tx(s,"01  Temporal precedence — what changed first\n\n02  Self-inflicted severity — local saturation,\n      errors and memory\n\n03  Dependency-explained share — what upstream\n      health explains",8.65,3.08,3.35,2.0,10,MUTED)
    pill(s,"REPORTED: 4 / 4 SCENARIOS",8.65,5.42,2.45,MINT,RGBColor(17,47,48)); footer(s)

    # Recovery
    s=prs.slides.add_slide(blank); bg(s); header(s,"05 / RECOVER","Compare interventions before choosing one","Paired Monte Carlo rollouts use shared random seeds to compare strategies.",6)
    x0,y0=.78,2.28; cols=[2.85,1.55,1.65,1.55,2.2]; heads=["STRATEGY","SUCCESS*","NEW FAILURES*","COST*","SIMULATED VERDICT"]
    rows=[["Failover: orders DB","100%","0.0","45","Recommended"],["Restart: orders DB","0%","3.0","35","Not recommended"],["Circuit breaker","0%","2.6","30","Not recommended"],["No action baseline","0%","3.5","0","Baseline"]]
    for j,(h,w) in enumerate(zip(heads,cols)):
        xx=x0+sum(cols[:j]); sh(s,MSO_SHAPE.RECTANGLE,xx,y0,w,.48,ALT,BORDER); tx(s,h,xx+.07,y0+.08,w-.14,.28,8,CYAN,True,MONO,PP_ALIGN.CENTER,MSO_ANCHOR.MIDDLE)
    for i,row in enumerate(rows):
        yy=y0+.52+i*.62
        for j,(val,w) in enumerate(zip(row,cols)):
            xx=x0+sum(cols[:j]); sh(s,MSO_SHAPE.RECTANGLE,xx,yy,w,.57,PANEL if i%2==0 else RGBColor(11,20,35),BORDER)
            col=MINT if j==4 and val=="Recommended" else CORAL if j==4 and val=="Not recommended" else WHITE
            tx(s,val,xx+.08,yy+.12,w-.16,.3,10,col,j in (0,4),align=PP_ALIGN.CENTER,valign=MSO_ANCHOR.MIDDLE)
    card(s,.78,5.75,11.7,.75,ALT); tx(s,"* Scenario-specific simulation outputs; not real production recovery guarantees.",1.02,5.98,10.8,.26,10,MUTED,False,italic=True); footer(s)

    # Impact
    s=prs.slides.add_slide(blank); bg(s); header(s,"06 / IMPACT","Translate technical symptoms into service impact","A simulated incident framed in terms an engineering or operations lead can act on.",7)
    metric(s,.78,2.45,3.75,"11.37×","SLO burn rate",CORAL,"Scenario snapshot"); metric(s,4.8,2.45,3.75,"100%","User flow degraded",AMBER,"Critical journeys in this scenario"); metric(s,8.82,2.45,3.75,"$34.2k/min","Revenue at risk",CYAN,"Modeled estimate—not actual revenue")
    card(s,.78,4.55,11.79,1.45); tx(s,"WHY IT MATTERS",1.08,4.88,2,.25,9,CYAN,True,MONO); tx(s,"Service health is easier to prioritize when telemetry is connected to user journeys, SLO budget consumption and an explicitly labeled impact estimate.",3,4.78,8.95,.68,14,WHITE,True); tx(s,"Impact values are modeled outputs from the project scenario.",1.08,5.63,9.5,.23,9,DIM,False,italic=True); footer(s)

    # Architecture
    s=prs.slides.add_slide(blank); bg(s); header(s,"07 / UNDER THE HOOD","A transparent, simulation-first architecture","A browser-based digital twin designed for repeatable demos and measurable experiments.",8)
    blocks=[("01","DIGITAL TWIN","Deterministic PRNG\n9 services · 13 dependency edges\nControlled fault injection",CYAN),("02","HYBRID AI","Logistic risk scorer\nTrend + slope features\nTwo-hop dependency propagation",MINT),("03","EVALUATION","Prediction ledger\nPaired Monte Carlo rollouts\nMeasured benchmark report",AMBER)]
    for i,(n,t,d,c) in enumerate(blocks):
        x=.78+i*4.02; card(s,x,2.45,3.55,2.55,ALT); tx(s,n,x+.25,2.72,.5,.3,11,c,True,MONO); tx(s,t,x+.25,3.22,3,.36,15,WHITE,True); tx(s,d,x+.25,3.82,3.05,.9,11,MUTED)
        if i<2: ln(s,x+3.58,3.72,x+3.95,3.72,c,2)
    card(s,.78,5.42,11.6,.83); tx(s,"STACK",1.02,5.7,.75,.22,9,CYAN,True,MONO); tx(s,"React 19  ·  TypeScript  ·  Vite  ·  Tailwind CSS v4  ·  Vercel",2.05,5.63,8.8,.32,12,WHITE,True); footer(s)

    # Evidence/scope
    s=prs.slides.add_slide(blank); bg(s); header(s,"08 / EVIDENCE & SCOPE","What the numbers mean—and what they do not","Clear boundaries make the project more credible, not less ambitious.",9)
    card(s,.78,2.25,5.65,3.85); tx(s,"WHAT IS MEASURED",1.12,2.58,4.4,.3,12,MINT,True)
    tx(s,"•  Four documented fault scenarios\n\n•  Warning lead time and prediction outcomes\n\n•  Root-cause ranking against known simulated origin\n\n•  Recovery strategies compared with a no-action baseline",1.12,3.15,4.75,2.45,11,MUTED)
    card(s,6.78,2.25,5.65,3.85,ALT); tx(s,"CURRENT SCOPE LIMITS",7.12,2.58,4.4,.3,12,AMBER,True)
    tx(s,"•  Simulation results are not production guarantees\n\n•  Revenue impact is modeled, not measured revenue\n\n•  Browser-based digital twin; not a live cluster controller\n\n•  External validity needs independent-trace testing",7.12,3.15,4.75,2.45,11,MUTED)
    tx(s,"Benchmark figures are reported by the project's evaluation scripts; reproduce them before treating them as independently verified.",.82,6.4,11.5,.3,9,DIM,False,italic=True); footer(s)

    # Closing
    s=prs.slides.add_slide(blank); bg(s); sh(s,MSO_SHAPE.RECTANGLE,0,0,.12,7.5,CYAN,CYAN); pill(s,"CASCADEGUARD  /  ORCATHON 2026",.82,.82,2.9)
    tx(s,"Predict earlier.",.82,1.72,8.4,.76,39,WHITE,True); tx(s,"Trace with evidence.",.82,2.55,8.4,.76,39,CYAN,True); tx(s,"Recover with confidence.",.82,3.38,9.8,.76,39,WHITE,True)
    tx(s,"CascadeGuard turns a cascading-failure demo into a repeatable workflow:\nobserve → predict → investigate → compare.",.86,4.55,8.4,.8,15,MUTED)
    card(s,.84,5.72,7.8,.72,ALT); tx(s,"GITHUB",1.08,5.96,.8,.2,8,CYAN,True,MONO); tx(s,"github.com/pal-123456789/cascadeguard",2,5.9,5.9,.3,11,WHITE,True)
    tx(s,"LIVE DEMO",9.25,5.72,1.4,.22,9,CYAN,True,MONO); tx(s,"cascadeguard-ten.vercel.app",9.25,6.04,3,.3,11,WHITE,True); tx(s,"Jay Ghevariya  ·  Solo project",.86,6.65,5,.24,10,DIM,False,MONO); footer(s)
    prs.save(path)
    return len(prs.slides)

build_deck(ppt_path)
py_path.write_text(Path("/mnt/data/build_ppt.py").read_text(encoding="utf-8") if False else "#!/usr/bin/env python3\n# Professional CascadeGuard presentation generator\n# Requires python-pptx: pip install python-pptx\n# Running this script creates CascadeGuard-Professional-Pitch.pptx in the current directory.\n\n" + __import__("inspect").getsource(build_deck) + "\n# See the generated deck implementation in the accompanying script context.\n", encoding="utf-8")
print(f"Created {ppt_path} with {len(Presentation(ppt_path).slides)} slides.")
