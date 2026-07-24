# Nguồn trích dẫn TEa — `analyte-catalog.js`

Mọi con số `clia`, `ricos`, `cliaAbsolute` trong
`assets/modules/analyte-catalog.js` là DỮ LIỆU LÂM SÀNG, không phải code:
chúng quyết định Sigma, xếp loại phương pháp và gợi ý thiết kế QC. File này là
hồ sơ truy xuất nguồn bắt buộc kèm theo (xem AGENTS.md — sửa một con số
clia/ricos/cliaAbsolute là một thay đổi dữ liệu cần lý do riêng).
`tests/tea-sources.test.js` chặn trạng thái "mồ côi trích dẫn": mọi measurand
trong catalog phải xuất hiện trong bảng truy xuất bên dưới.

## Tài liệu nguồn

1. **CLIA — tiêu chuẩn chấp nhận Proficiency Testing** (cột `clia` và
   `cliaAbsolute`): 42 CFR Part 493, Subpart I (§§493.801–493.959), sửa đổi
   bởi Final Rule 11/07/2024 — văn bản CMS QSO-24-15-CLIA.
   - https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493
   - https://www.cms.gov/files/document/qso-24-15-clia-revised-2024-07-08.pdf
2. **Biological Variation Database của EFLM** (cột `ricos`): TEa mức
   "desirable" theo biến thiên sinh học — Ricos C. et al.,
   *Scand J Clin Lab Invest* 1999;59(7):491–500, cập nhật định kỳ bởi EFLM
   BV Committee. Công thức: TEa = 1,65×(0,5×CVi) + 0,250×√(CVi²+CVg²).
   - https://biologicalvariation.eu
3. **Bảng tổng hợp CLIA của Westgard QC** (nguồn thứ cấp, chỉ dùng đối chiếu
   chéo, không phải nguồn gốc):
   - https://www.westgard.com/clia-and-quality-regulation-requirements/quality-requirements/2024-clia-requirements.html

## Quy ước áp dụng

- `clia` = giới hạn theo % trên giá trị mục tiêu.
- `cliaAbsolute` kèm `cliaAbsoluteUnit` = giới hạn tuyệt đối; chỉ được quy
  đổi/áp dụng khi đơn vị của xét nghiệm KHỚP đúng đơn vị tiêu chuẩn (quy tắc
  nghiệp vụ đã chốt trong sigma.js). Với tiêu chuẩn dạng "X% hoặc Y đơn vị,
  lấy lớn hơn", catalog giữ cả hai nhánh.
- Ô "— chưa có tiêu chuẩn —" nghĩa là nguồn tương ứng không ban hành tiêu
  chuẩn định lượng cho measurand đó (ví dụ xét nghiệm định tính, hoặc analyte
  CLIA chưa đưa vào PT) — KHÔNG phải thiếu sót của catalog.
- Giá trị `ricos` có thể khác vài phần trăm giữa các lần cập nhật BV database;
  con số trong catalog chụp tại ngày rà soát ghi bên dưới.

## Bảng truy xuất theo measurand

| analyteId | Measurand | Viết tắt | Khoa | Nguồn TEa có sẵn |
|---|---|---|---|---|
| qclab-albumin | Albumin | ALB | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-alp | Alkaline phosphatase | ALP | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-alt | Alanine aminotransferase | ALT | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-ast | Aspartate aminotransferase | AST | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-amylase | Amylase | AMY | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-bilirubin-total | Total bilirubin | TBIL | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-bilirubin-direct | Direct bilirubin | DBIL | Hóa sinh | BV (Ricos/EFLM) |
| qclab-calcium | Calcium | Ca | Hóa sinh | CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-chloride | Chloride | Cl | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-cholesterol-total | Total cholesterol | TC | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-ck | Creatine kinase | CK | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-ck-mb | Creatine kinase-MB | CK-MB | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-creatinine | Creatinine | CREA | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-ggt | Gamma-glutamyl transferase | GGT | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-glucose | Glucose | GLU | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-hdl-c | HDL cholesterol | HDL-C | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-ldh | Lactate dehydrogenase | LDH | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-ldl-c | LDL cholesterol | LDL-C | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-lipase | Lipase | LIP | Hóa sinh | BV (Ricos/EFLM) |
| qclab-magnesium | Magnesium | Mg | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-phosphate | Phosphate | PHOS | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-potassium | Potassium | K | Hóa sinh | CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-protein-total | Total protein | TP | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-sodium | Sodium | Na | Hóa sinh | CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-iron | Iron | Fe | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-triglycerides | Triglycerides | TG | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-troponin-i | Cardiac troponin I | cTnI | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-troponin-t | Cardiac troponin T | cTnT | Hóa sinh | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-urea | Urea | UREA | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-uric-acid | Uric acid | UA | Hóa sinh | CLIA % + BV (Ricos/EFLM) |
| qclab-afp | Alpha-fetoprotein | AFP | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-anti-hbs | Hepatitis B surface antibody | Anti-HBs | Miễn dịch | — chưa có tiêu chuẩn — |
| qclab-ca-125 | Cancer antigen 125 | CA 125 | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-ca-19-9 | Carbohydrate antigen 19-9 | CA 19-9 | Miễn dịch | BV (Ricos/EFLM) |
| qclab-cea | Carcinoembryonic antigen | CEA | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-cortisol | Cortisol | COR | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-ferritin | Ferritin | FER | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-folate | Folate | FOL | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-fsh | Follicle-stimulating hormone | FSH | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-hba1c | Hemoglobin A1c | HbA1c | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-hcg | Human chorionic gonadotropin | hCG | Miễn dịch | CLIA % + CLIA tuyệt đối |
| qclab-insulin | Insulin | INS | Miễn dịch | BV (Ricos/EFLM) |
| qclab-lh | Luteinizing hormone | LH | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-myoglobin | Myoglobin | MYO | Miễn dịch | BV (Ricos/EFLM) |
| qclab-nt-probnp | N-terminal pro-B-type natriuretic peptide | NT-proBNP | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-prolactin | Prolactin | PRL | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-psa | Prostate-specific antigen | PSA | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-t3-total | Total triiodothyronine | TT3 | Miễn dịch | CLIA % + BV (Ricos/EFLM) |
| qclab-ft3 | Free triiodothyronine | FT3 | Miễn dịch | BV (Ricos/EFLM) |
| qclab-ft4 | Free thyroxine | FT4 | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-t4-total | Total thyroxine | TT4 | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-testosterone | Testosterone | TESTO | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-tsh | Thyroid-stimulating hormone | TSH | Miễn dịch | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-vitamin-b12 | Vitamin B12 | B12 | Miễn dịch | CLIA % + CLIA tuyệt đối |
| qclab-vitamin-d-25-oh | 25-hydroxyvitamin D | 25-OH-D | Miễn dịch | — chưa có tiêu chuẩn — |
| qclab-blood-gas-ph | pH | pH | Khí máu | CLIA tuyệt đối |
| qclab-blood-gas-pco2 | Carbon dioxide partial pressure | pCO2 | Khí máu | CLIA % + CLIA tuyệt đối + BV (Ricos/EFLM) |
| qclab-blood-gas-po2 | Oxygen partial pressure | pO2 | Khí máu | CLIA % + CLIA tuyệt đối |
| qclab-blood-gas-hco3 | Bicarbonate | HCO3- | Khí máu | BV (Ricos/EFLM) |
| qclab-blood-gas-base-excess | Base excess | BE | Khí máu | — chưa có tiêu chuẩn — |
| qclab-blood-gas-sao2 | Arterial oxygen saturation | SaO2 | Khí máu | — chưa có tiêu chuẩn — |
| qclab-blood-gas-fio2 | Fraction of inspired oxygen | FiO2 | Khí máu | — chưa có tiêu chuẩn — |
| qclab-blood-gas-lactate | Lactate | Lac | Khí máu | BV (Ricos/EFLM) |
| qclab-blood-gas-hemoglobin | Hemoglobin | HGB | Huyết học | CLIA % + BV (Ricos/EFLM) |
| qclab-blood-gas-hematocrit | Hematocrit | HCT | Huyết học | CLIA % + BV (Ricos/EFLM) |
| qclab-leukocyte-count | Leukocyte count | WBC | Huyết học | CLIA % |
| qclab-erythrocyte-count | Erythrocyte count | RBC | Huyết học | CLIA % |
| qclab-platelet-count | Platelet count | PLT | Huyết học | CLIA % |
| qclab-mcv | Mean corpuscular volume | MCV | Huyết học | — chưa có tiêu chuẩn — |
| qclab-mch | Mean corpuscular hemoglobin | MCH | Huyết học | — chưa có tiêu chuẩn — |
| qclab-mchc | Mean corpuscular hemoglobin concentration | MCHC | Huyết học | — chưa có tiêu chuẩn — |
| qclab-rdw | Red cell distribution width | RDW | Huyết học | — chưa có tiêu chuẩn — |
| qclab-prothrombin-time | Prothrombin time | PT | Đông máu | CLIA % |
| qclab-inr | International normalized ratio | INR | Đông máu | CLIA % |
| qclab-aptt | Activated partial thromboplastin time | aPTT | Đông máu | CLIA % |
| qclab-fibrinogen | Fibrinogen | FIB | Đông máu | CLIA % |
| qclab-d-dimer | D-dimer | D-Dimer | Đông máu | — chưa có tiêu chuẩn — |

## Biên bản rà soát

- **2026-07-24**: đối chiếu các giá trị neo với bảng CLIA 2024 (Albumin 8%;
  ALT 15%/6 U/L; AST 15%/6 U/L; Glucose 8%/6 mg/dL; Creatinine 10%/0,2 mg/dL;
  GGT 15%/5 U/L; HbA1c 8%; TSH 20%/0,2 mIU/L; hCG 18%/3 mIU/mL;
  FSH 18%/2 IU/L; Folate 30%/1 ng/mL; Vitamin B12 25%/30 pg/mL;
  pCO2 8%/5 mmHg; pO2 15%/15 mmHg; pH 0,04; Calcium 1,0 mg/dL;
  Potassium 0,3 mmol/L; Sodium 4 mmol/L; HDL 20%/6 mg/dL; LDL 20%;
  CK 20%; LDH 15%; Iron 15%; Magnesium 15%; Cortisol 20%; T3 30%) — TẤT CẢ KHỚP.
  Hai điểm CẦN XÁC MINH THÊM, chưa sửa vì thay đổi số liệu cần quyết định của
  chủ sở hữu:
  - `uric-acid`: catalog `clia:10`, trong khi CLIA 2024 là ±15% — có thể
    là giá trị siết chặt có chủ đích (siết hơn tiêu chuẩn không vi phạm, chỉ
    cần ghi nhận là quyết định của lab).
  - `triglycerides`: catalog `clia:15`, CLIA bản cũ ±25% — cần đối chiếu
    lại bảng CLIA 2024 cho TG trước khi kết luận.
- **Kỳ rà soát tiếp theo**: chậm nhất 2027-07, hoặc ngay khi CMS/EFLM công bố
  cập nhật tiêu chuẩn.
