# AI-Assisted OA Risk Screening System — Project Overview
### North Eastern Region (NER) Deployment | Software-Only Architecture

---

## 1. Project Summary

An affordable, fully software-based screening tool that helps identify possible **Osteoarthritis (OA) risk markers**, intended for regions like India's North Eastern Region where specialist healthcare and imaging access may be limited.

The system is a **screening and referral aid**, not a diagnostic device. It never claims to replace a doctor or deliver a clinical diagnosis — its job is to flag people who may benefit from further clinical evaluation.

---

## 2. Core Principle

> **AI-Assisted Screening and Risk Marker Detection** — not diagnosis.

Every output must be framed as a risk indication with a recommendation (e.g. *"clinical evaluation recommended"*), never as a medical finding.

---

## 3. System Inputs — Three Independent Modules

The system combines up to three input sources. Each can work **standalone** — a clinic without an X-ray machine still gets a useful result from movement + questionnaire alone, and vice versa.

| Module | Input | Output |
|---|---|---|
| **Movement Analysis** | Webcam video of sit-to-stand, short walk, standing posture | Gait/mobility risk score |
| **Patient Questionnaire** | Age, pain level, stiffness, injury history, activity level | Symptom-based risk score |
| **X-ray Analysis** (optional) | Uploaded knee X-ray image | KL Grade prediction → risk score |

---

## 4. Architecture

```
                        ┌─────────────────┐
                        │   Desktop App    │
                        │  (offline, local)│
                        └────────┬─────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                         │
  Movement Test           Questionnaire              X-ray Upload
  (webcam capture)        (form input)               (image file)
        │                        │                         │
  MediaPipe Pose            Feature vector          Preprocessing +
  Estimation                (age, pain, etc.)        Knee ROI crop
        │                        │                         │
  Feature Extraction:            │                   CNN (ResNet/
  knee angle, symmetry,          │                   EfficientNet,
  gait speed, sit-to-                                transfer-learned
  stand timing                   │                   on OAI dataset)
        │                        │                         │
  Random Forest /          Random Forest /            KL Grade (0–4)
  XGBoost model             Logistic Regression        + Grad-CAM
        │                        │                         │
        └──────────┬─────────────┴─────────────┬──────────┘
                    │                            │
              Ensemble / Late Fusion      (or standalone if
              of available scores          only one input given)
                    │
                    ▼
         Risk Category: Low / Moderate / High
                    │
                    ▼
      Recommendation: Monitor / Preventive Guidance /
                Clinical Evaluation Recommended
```

**Key design decision:** the movement and questionnaire scores stay independently visible (not silently merged into one number) so a healthcare worker can see *why* a result was flagged — e.g. "movement: moderate, questionnaire: high."

---

## 5. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python | Matches CV/ML ecosystem, single stack throughout |
| Computer Vision | OpenCV | Video capture, preprocessing |
| Pose Estimation | MediaPipe | Lightweight, runs on CPU, well-documented |
| Movement/Questionnaire ML | Random Forest / XGBoost (ensemble) | Small datasets (tens–hundreds of subjects) — classical ML avoids overfitting; keeps explainability via feature importance |
| X-ray ML | CNN (ResNet-18/34 or EfficientNet-B0, transfer learning) | Large labeled dataset (OAI, ~47,000 X-rays) supports deep learning; matches published benchmarks |
| Explainability | Grad-CAM (X-ray module) | Shows *where* the model is focusing, builds trust |
| UI / App Shell | Streamlit or PyQt | Desktop app, fully offline, no server dependency |

**No hardware component** — the system runs on whatever laptop/PC is already available. "Portable" means the software runs anywhere, not that dedicated hardware is built or shipped.

---

## 6. Datasets Identified

| Dataset | Use | Notes |
|---|---|---|
| **KOA-PD-NM Gait Dataset** (Kour, Gupta, Arora, 2020 — Mendeley/Zenodo, CC BY 4.0) | Movement/gait model training & validation | 50 KOA patients (early/moderate/severe) + healthy controls, sagittal-plane video, already used with MediaPipe in published research |
| **VidSole** (2025) | Future sensor-fusion reference | 52 subjects, RGB + insole + motion capture; useful if IMU is reconsidered later |
| **OAI (Osteoarthritis Initiative)** | X-ray model training | ~4,796 participants, ~47,000 KL-graded radiographs; free, requires registration |
| **Pre-cropped KL-graded derivative sets** (Mendeley/Kaggle) | Faster X-ray prototyping | Skips joint-detection/cropping step |

**Known gap:** none of these datasets are NER-specific. A small local validation cohort (even 20–30 subjects, assessed by a physiotherapist) is recommended before claiming generalizability to the target population.

---

## 7. Movement Tests Selected

Chosen for clinical relevance *and* safety (low fall/injury risk):

1. **Sit-to-stand** (5x or 30-second variant) — validated functional mobility measure
2. **Short timed walk** (~4–10m) — standard gait speed test
3. **Standing posture / static balance**

Deep squats/knee bending are avoided or made optional — safety risk outweighs the marginal data value for a screening tool.

---

## 8. Risk Scoring Approach

- **Phase 1 (MVP):** Late-fusion ensemble — separate Random Forest models for movement and questionnaire features, combined by voting/averaging, with a transparent rule-based score running alongside as a sanity check.
- **X-ray module:** Independent CNN output mapped to a risk category, combinable with the other two scores or usable standalone.
- **Not used at this stage:** deep learning on the movement/questionnaire side (data too small), or multimodal deep fusion architectures (premature before sufficient data volume).

---

## 9. Validation Methodology

1. **Reproduce first:** validate the pose-estimation + classical ML pipeline against KOA-PD-NM's existing severity labels before any new data collection.
2. **Clinical ground truth:** partner with a physiotherapist/orthopedic clinician to assess a small validation cohort using an established scale (WOMAC index or KL grade).
3. **Track real metrics:** sensitivity/specificity against labeled outcomes — not just "the demo works."

---

## 10. MVP Build Order

1. **Pipeline validation on public data** — run KOA-PD-NM through MediaPipe, extract features, confirm reproducible results before building anything new.
2. **Feature engineering + classical ML baseline** — joint angle, symmetry, sit-to-stand timing → Random Forest baseline.
3. **Questionnaire module + rule-based fallback score.**
4. **Webcam MVP application** — desktop app wiring camera + questionnaire into one working tool with Low/Moderate/High output.
5. **Local pilot validation** — test against a clinician's informal assessment.
6. **X-ray module** (parallel/later track) — CNN trained on OAI, added as a third input tab.

*(Hardware-porting step removed — project is software-only.)*

---

## 11. Open Considerations

- **Fixed test protocol:** camera distance/angle and movement sequence must be standardized before data collection — pose-estimation accuracy is sensitive to setup, more so than model choice.
- **Regulatory awareness:** India's CDSCO has rules around AI-based screening/medical software. Not a blocker at prototype/college-project stage, but worth knowing before any real-world pilot or deployment beyond that.
- **Framing discipline:** the X-ray module in particular sits closer to "diagnostic" territory (KL grading is a real diagnostic measure) — keep output language as risk/referral, never diagnosis, even here.

---

## 12. Key Questions Resolved So Far

| Original Question | Resolution |
|---|---|
| Realistic RGB camera risk markers? | Functional/mobility markers yes (angle, gait, symmetry); structural markers (joint space, osteophytes) no — X-ray needed for those |
| Suitable public datasets? | Yes — KOA-PD-NM (gait), OAI (X-ray) |
| Clinically meaningful, safe movement tests? | Sit-to-stand, timed walk, standing posture |
| Camera-only or IMU? | Camera-only, permanently (hardware removed from scope) |
| How to combine questionnaire + movement? | Late-fusion ensemble, kept independently visible |
| How to validate? | Reproduce on public labels first, then clinician-assessed local cohort |
