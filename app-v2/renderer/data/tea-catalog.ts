// Danh mục TEa chuẩn port nguyên giá trị CLIA/Ricos từ app cũ
// (`TEA_ANALYTE_CATALOG`). Đây là dữ liệu tham chiếu chỉ đọc; hồ sơ TEa PXN
// trong SQLite được hiển thị như lớp phủ riêng, không ghi đè catalog này.
export type TeaCatalogItem = { id: string; name: string; abbr: string; unit: string; section: string; clia: number | null; ricos: number | null };
type TeaCatalogSeed = readonly [
  id: string,
  name: string,
  abbr: string,
  unit: string,
  section: string,
  clia: number | null,
  ricos: number | null,
];

const TEA_CATALOG_ROWS: readonly TeaCatalogSeed[] = [
  ['albumin','Albumin','ALB','g/L','Hóa sinh',8,4.07], ['alp','Alkaline phosphatase','ALP','U/L','Hóa sinh',20,12.04], ['alt','Alanine aminotransferase','ALT','U/L','Hóa sinh',15,27.48], ['ast','Aspartate aminotransferase','AST','U/L','Hóa sinh',15,16.69], ['amylase','Amylase','AMY','U/L','Hóa sinh',20,14.6], ['bilirubin-total','Total bilirubin','TBIL','µmol/L','Hóa sinh',20,26.94], ['bilirubin-direct','Direct bilirubin','DBIL','µmol/L','Hóa sinh',null,44.5], ['calcium','Calcium','Ca','mmol/L','Hóa sinh',null,2.55], ['chloride','Chloride','Cl','mmol/L','Hóa sinh',5,1.5], ['cholesterol-total','Total cholesterol','TC','mmol/L','Hóa sinh',10,9.01],
  ['ck','Creatine kinase','CK','U/L','Hóa sinh',20,30.3], ['ck-mb','Creatine kinase-MB','CK-MB','U/L','Hóa sinh',25,30.06], ['creatinine','Creatinine','CREA','µmol/L','Hóa sinh',10,8.87], ['ggt','Gamma-glutamyl transferase','GGT','U/L','Hóa sinh',15,22.11], ['glucose','Glucose','GLU','mmol/L','Hóa sinh',8,6.96], ['hdl-c','HDL cholesterol','HDL-C','mmol/L','Hóa sinh',20,11.63], ['ldh','Lactate dehydrogenase','LDH','U/L','Hóa sinh',15,11.4], ['ldl-c','LDL cholesterol','LDL-C','mmol/L','Hóa sinh',20,11.9], ['lipase','Lipase','LIP','U/L','Hóa sinh',null,37.88], ['magnesium','Magnesium','Mg','mmol/L','Hóa sinh',15,4.8],
  ['phosphate','Phosphate','PHOS','mmol/L','Hóa sinh',10,10.11], ['potassium','Potassium','K','mmol/L','Hóa sinh',null,5.61], ['protein-total','Total protein','TP','g/L','Hóa sinh',8,3.63], ['sodium','Sodium','Na','mmol/L','Hóa sinh',null,.73], ['iron','Iron','Fe','µmol/L','Hóa sinh',15,30.7], ['triglycerides','Triglycerides','TG','mmol/L','Hóa sinh',15,25.99], ['troponin-i','Cardiac troponin I','cTnI','ng/mL','Hóa sinh',30,27.91], ['troponin-t','Cardiac troponin T','cTnT','ng/mL','Hóa sinh',30,48.9], ['urea','Urea','UREA','mmol/L','Hóa sinh',9,15.55], ['uric-acid','Uric acid','UA','µmol/L','Hóa sinh',10,11.97],
  ['afp','Alpha-fetoprotein','AFP','ng/mL','Miễn dịch',20,21.9], ['anti-hbs','Hepatitis B surface antibody','Anti-HBs','IU/L','Miễn dịch',null,null], ['ca-125','Cancer antigen 125','CA 125','U/mL','Miễn dịch',20,35.4], ['ca-19-9','Carbohydrate antigen 19-9','CA 19-9','U/mL','Miễn dịch',null,46.03], ['cea','Carcinoembryonic antigen','CEA','ng/mL','Miễn dịch',15,24.7], ['cortisol','Cortisol','COR','nmol/L','Miễn dịch',20,22.8], ['ferritin','Ferritin','FER','ng/mL','Miễn dịch',20,16.9], ['folate','Folate','FOL','ng/mL','Miễn dịch',30,39], ['fsh','Follicle-stimulating hormone','FSH','IU/L','Miễn dịch',18,21.19], ['hba1c','Hemoglobin A1c','HbA1c','%','Miễn dịch',8,3],
  ['hcg','Human chorionic gonadotropin','hCG','mIU/mL','Miễn dịch',18,null], ['insulin','Insulin','INS','µIU/mL','Miễn dịch',null,32.9], ['lh','Luteinizing hormone','LH','IU/L','Miễn dịch',20,27.92], ['myoglobin','Myoglobin','MYO','ng/mL','Miễn dịch',null,19.6], ['nt-probnp','N-terminal pro-B-type natriuretic peptide','NT-proBNP','pg/mL','Miễn dịch',30,13], ['prolactin','Prolactin','PRL','ng/mL','Miễn dịch',20,29.4], ['psa','Prostate-specific antigen','PSA','ng/mL','Miễn dịch',20,33.6], ['t3-total','Total triiodothyronine','TT3','nmol/L','Miễn dịch',30,9.22], ['ft3','Free triiodothyronine','FT3','pmol/L','Miễn dịch',null,11.3], ['ft4','Free thyroxine','FT4','pmol/L','Miễn dịch',15,8],
  ['t4-total','Total thyroxine','TT4','nmol/L','Miễn dịch',20,7], ['testosterone','Testosterone','TESTO','nmol/L','Miễn dịch',30,13.61], ['tsh','Thyroid-stimulating hormone','TSH','mIU/L','Miễn dịch',20,23.7], ['vitamin-b12','Vitamin B12','B12','pg/mL','Miễn dịch',25,null], ['vitamin-d-25-oh','25-hydroxyvitamin D','25-OH-D','ng/mL','Miễn dịch',null,null],
  ['blood-gas-ph','pH','pH','','Khí máu',null,null], ['blood-gas-pco2','Carbon dioxide partial pressure','pCO2','mmHg','Khí máu',8,5.7], ['blood-gas-po2','Oxygen partial pressure','pO2','mmHg','Khí máu',15,null], ['blood-gas-hco3','Bicarbonate','HCO3-','mmol/L','Khí máu',null,5.6], ['blood-gas-base-excess','Base excess','BE','mmol/L','Khí máu',null,null], ['blood-gas-sao2','Arterial oxygen saturation','SaO2','%','Khí máu',null,null], ['blood-gas-fio2','Fraction of inspired oxygen','FiO2','%','Khí máu',null,null], ['blood-gas-lactate','Lactate','Lac','mmol/L','Khí máu',null,30.4],
  ['blood-gas-hemoglobin','Hemoglobin','HGB','g/dL','Huyết học',4,4.19], ['blood-gas-hematocrit','Hematocrit','HCT','%','Huyết học',4,3.97], ['leukocyte-count','Leukocyte count','WBC','10^3/µL','Huyết học',10,null], ['erythrocyte-count','Erythrocyte count','RBC','10^6/µL','Huyết học',4,null], ['platelet-count','Platelet count','PLT','10^3/µL','Huyết học',25,null], ['mcv','Mean corpuscular volume','MCV','fL','Huyết học',null,null], ['mch','Mean corpuscular hemoglobin','MCH','pg','Huyết học',null,null], ['mchc','Mean corpuscular hemoglobin concentration','MCHC','g/dL','Huyết học',null,null], ['rdw','Red cell distribution width','RDW','%','Huyết học',null,null],
  ['prothrombin-time','Prothrombin time','PT','s','Đông máu',15,null], ['inr','International normalized ratio','INR','ratio','Đông máu',15,null], ['aptt','Activated partial thromboplastin time','aPTT','s','Đông máu',15,null], ['fibrinogen','Fibrinogen','FIB','mg/dL','Đông máu',20,null], ['d-dimer','D-dimer','D-Dimer','mg/L FEU','Đông máu',null,null],
];

export const TEA_CATALOG: readonly TeaCatalogItem[] = TEA_CATALOG_ROWS.map(
  ([id, name, abbr, unit, section, clia, ricos]) => ({
    id: `qclab-${id}`,
    name,
    abbr,
    unit,
    section,
    clia,
    ricos,
  }),
);

export const TEA_SOURCE_CARDS = [
  { label: 'CLIA PT (CMS-3355-F)', detail: 'CMS-3355-F / 42 CFR §§493.931, 493.941 · hiệu lực 11/07/2024 · rà soát 16/07/2026', tag: 'Hiện hành', tone: 'reference', url: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-493/subpart-I' },
  { label: 'Ricos / Westgard BV', detail: '2014 · rà soát 16/07/2026', tag: 'Nguồn cũ', tone: 'retired', url: 'https://westgard.com/clia-and-quality-regulation-requirements/quality-requirements/biodatabase1.html' },
  { label: 'EFLM Biological Variation Database', detail: 'Live database · rà soát 16/07/2026', tag: 'Cập nhật liên tục', tone: 'dynamic', url: 'https://biologicalvariation.eu/' },
] as const;
