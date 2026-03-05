/**
 * convert-linus-csv.js
 *
 * Reads linus.csv → outputs import-ready CSV matching LK PharmaCare template.
 * Only keeps: Product→name, API→generic_name, Retail_Price→unit_price, Cost_Price→cost_price
 * Everything else gets clean defaults (new system, fresh stock).
 */

const XLSX = require("xlsx");
const path = require("path");

// ── Keyword → category rules (checked top-down, first match wins) ──
const RULES = [
  // ─── BEAUTY / NON-PHARMACY ───
  {
    re: /\b(ky\s*\d{3,}|tn\s*\d{3,}|amg\s*\d|bata bullet|bata sandal|nike\s*\d)/i,
    cat: "Footwear",
  },
  {
    re: /\b(hair gel|hair food|hair fertilizer|styling.*gel|moulding.*gel|curl activ|hair relax|shamp|shampo|hair dye|black rose dye|dye subaru|bamsi|movit)/i,
    cat: "Hair Care",
  },
  {
    re: /\b(hair ring|hair band|comb|hair clip|hair pin|weaving cap)/i,
    cat: "Hair Accessories",
  },
  {
    re: /\b(perfume|fragrance|body luxe|spray 2 in 1|body spray)/i,
    cat: "Perfumes & Fragrances",
  },
  {
    re: /\b(coconut oil|glycerine|glycerin|nice and lovely|nice\s*&\s*lovely|vaseline|blueseal|arimis|skala|roseleaf)/i,
    cat: "Oils & Serums",
  },
  {
    re: /\b(maxilight|goldtouch beauty|heel cream|beauty cream|brazilian)/i,
    cat: "Skin Care",
  },
  { re: /\b(lipgloss|lipstick|eye pencil|huda beauty|makeup)/i, cat: "Makeup" },
  { re: /\b(valon|qtex|stella)\b/i, cat: "Clothing & Apparel" },
  {
    re: /\b(key holder|bangle|chain\b|watch\b|fish net|rubber band|pegs\b|handkerchief|towel|shower cap|face towel|scrubbing brush|kitchen towel|tissue|jumbo roll|super glue|razer blade|touch and go|sifa\b|savviet)/i,
    cat: "General Accessories",
  },
  {
    re: /\b(sanitary pad|softcare|diapers|pampers|baby love|baby powder|baby care|babycare|femi lydia|bonsens)/i,
    cat: "General Accessories",
  },
  {
    re: /\b(condom|trust studded|toothbrush|toothpaste|colgate|aquafresh|t-guard)/i,
    cat: "General Accessories",
  },

  // ─── PHARMACY ───
  // Antibiotics (including antimalarials & antivirals)
  {
    re: /\b(amoxicillin|cefuroxime|ciprofloxacin|azithromycin|clindamycin|flucloxacillin|ampicillin|cloxacillin|ceftriaxone|cefixime|cefadroxil|cefalexin|erythromycin|clarithromycin|levofloxacin|doxycycline|gentamicin|neomycin|sulfamethoxazole|trimethoprim|nitrofurantoin|benzylpenicillin|benzathine penicillin|aminosidine|metronidazole|tinidazole|secnidazole|nitazoxanide|pyrantel|albendazole|mebendazole|levamisole|ctx|septrin|flagyl|ampiclox|augmentin|claxyclav|fluclox|amoxil|acyclovir|acirax|artemether|lumefantrine|dihydroartemisinin|piperaquine|p-alaxin|artemed|malafin|pyrimethamine|sulfadoxine|fanlar|chlorhexidine|remidin)/i,
    cat: "Antibiotics",
  },

  // Painkillers
  {
    re: /\b(paracetamol|ibuprofen|diclofenac|tramadol|mefenamic|piroxicam|aceclofenac|celecoxib|etoricoxib|meloxicam|indomethacin|lornoxicam|ketorolac|ketoprofen|aspirin|acetylsalicylic|codeine|menthol|wintergreen|methyl salicylate|capsicum|deep heat|pharmasal|kaluma.*balm|relax mentho|menthoplus|pcm|panadol|betapyn|brufen|brustan|hedex|kaluma.*strong|kaluma.*kumeza|apc\b|cold\s*cap|flamoryl|myospaz|lobak|doloact|acetal|enzoflam|chlorzoxazone|oxifast|siclofen|lofen mr|zulu.*modified)/i,
    cat: "Painkillers",
  },

  // Antihistamines
  {
    re: /\b(cetirizine|loratadine|levocetirizine|chlorpheniramine|promethazine|diphenhydramine|dexchlorpheniramine|cyproheptadine|olopatadine|cpm\b|surdex|celestamine|dawahist|lunahist|nicof|alcof|zefcolin|levocet|cetzan|zycet|coldcap|flugone|rinovil|niramin|largan|tridex|antihistamine)/i,
    cat: "Antihistamines",
  },

  // Antacids
  {
    re: /\b(antacid|aluminium.*magnesium|magnesium.*aluminium|omeprazole|esomeprazole|lansoprazole|rabeprazole|pantoprazole|eno\b|gaviscon|neutricid|stomacid|relcer|acto\b|onecid|flatameal|magnacid|gastro gel|gastrokit)/i,
    cat: "Antacids",
  },

  // Antifungals
  {
    re: /\b(clotrimazole|fluconazole|ketoconazole|terbinafine|griseofulvin|nystatin|miconazole|clozole|labesten|dazole cream|canazol|candistat|whitfield|benzoic acid|oncosil|clotrine|benzyl benzoate)/i,
    cat: "Antifungals",
  },

  // Cardiovascular
  {
    re: /\b(carvedilol|amlodipine|atenolol|bisoprolol|nifedipine|losartan|enalapril|hydrochlorothiazide|spironolactone|furosemide|methyldopa|hydralazine|clopidogrel|valsartan|sacubitril|cinnarizine|finasteride|concor|varinil|amlozaar|lonet|cardace|carditan|bisocard|nifelong|vidol|aldomet|lasix|lactone|dicard|cosgrel|stugeron|atorvastatin|atstat|rivaroxaban|xarelto)/i,
    cat: "Cardiovascular",
  },

  // Diabetes
  {
    re: /\b(metformin|glibenclamide|gliclazide|empagliflozin|insulin|glucophage|glucomet|nogluc|diagluc|gludown|empiget)/i,
    cat: "Diabetes",
  },

  // Respiratory
  {
    re: /\b(salbutamol|montelukast|theophylline|ventolin|azmasol|cough|expectorant|herbigor|benylin|ascoril|kofgon|tricohist|good morning|combivent|ipratropium|franol|inhaler|bronchodilator|mucolytic|ambroxol|sekrol|philcorim|pholcorim)/i,
    cat: "Respiratory",
  },

  // Vitamins & Supplements
  {
    re: /\b(vitamin|multivitamin|folic acid|ferrous|iron|calcium|zinc|omega|cod liver|haematinic|hemoforce|ranferon|ifas|seven seas|scotts emulsion|neurobion|neuro forte|enervit|calciplex|limcee|osteocare|glucosamine|chondroitin|jointflex|jointace|cartil|carticare|cartisafe|mzcal|amino acid|appetite stimulant|bonnisan|ribena|lucozid|glutamic acid|bg.glutamin)/i,
    cat: "Vitamins & Supplements",
  },

  // Dermatology
  {
    re: /\b(betamethasone|hydrocortisone|triamcinolone|methylprednisolone|prednisolone|dexamethasone.*cream|tretinoin|benzoyl peroxide|calamine|acriflavine|mupirocin|silver sulfadiazine|tacrolimus|sulfur|epiderm|betason|bulkot|funbact|mediven|elyvate|extraderm|probeta|diproson|diprofos|acnesol|pernex|norash|grabacin|burnox|nebanol|topical cream|salicylic acid)/i,
    cat: "Dermatology",
  },

  // Gastrointestinal
  {
    re: /\b(lactulose|bisacodyl|loperamide|ondansetron|metoclopramide|domperidone|hyoscine|dicyclomine|diloxanide|gripe water|ors\b|dextrose|normal saline|hartmann|saccharomyces|tranexamic|plasil|buscopan|dulcolax|coramide|ridon|emitoss|ondem|zofran|hycin|cyclopam|neopeptine|floranorm|nosic|liquid parafin|paraffin|oxybutynin)/i,
    cat: "Gastrointestinal",
  },

  // Eye & Ear
  {
    re: /\b(eye\s*drop|ear\s*drop|ophthalmic|timolol|fluorometholone|flarex|dexneo|alacot|abgenta|nosfree|tml\b|otorex|dexa eye)/i,
    cat: "Eye & Ear",
  },

  // Other (medical supplies, tests, psychiatric, hormonal, misc)
  {
    re: /\b(bandage|cannula|syringe|needle|suture|blade surgical|gloves|plaster|elastoplast|cotton wool|velvex|mediwool|crepe bandage|mask.*face|medicine envelope|medical supplies|serviette|test:|hiv test|malaria rdt|pregnancy.*test|h[.\s-]*pylori.*test|salmonella|blood glucose test|hb test|infusion|giving set|vaccine|anti rabies|povidone iodine|surgical spirit|methylated spirit|hydrogen peroxide|chlorine|waterguard|dettol|hand sanitizer|mouthwash|strepsils|lozenges|teething powder|bladder|non med)/i,
    cat: "Other",
  },
];

// ── Dispensing unit guesser ─────────────────────────────────────
function guessUnit(p, a) {
  const s = `${p} ${a}`.toLowerCase();
  if (/cream|ointment|gel\b/i.test(s)) return "Tube";
  if (
    /syrup|susp|suspension|oral liquid|dry.*syrup|\d+ml\b|expectorant|gripe/i.test(
      s,
    )
  )
    return "Bottle";
  if (/injection|inj\b|i\.v|iv\b|\d+mg\/\d+ml/i.test(s)) return "Vial";
  if (/capsule|caps?\b/i.test(s)) return "Capsule";
  if (/sachet/i.test(s)) return "Sachet";
  if (/inhaler|spray/i.test(s)) return "Piece";
  if (/drop/i.test(s)) return "Bottle";
  if (/strip/i.test(s)) return "Strip";
  if (/powder/i.test(s)) return "Box";
  if (/tablet|tab\b|mg\b|dispersible/i.test(s)) return "Tablet";
  return "Piece";
}

// ── Classify ────────────────────────────────────────────────────
function classify(product, api) {
  const combined = `${product} ${api}`;
  for (const r of RULES) if (r.re.test(combined)) return r.cat;
  return "Other";
}

// ── Barcode ─────────────────────────────────────────────────────
let bc = 0;
function barcode() {
  bc++;
  return `LIN${Date.now().toString(36).toUpperCase()}${String(bc).padStart(4, "0")}`;
}

// ── Main ────────────────────────────────────────────────────────
const inFile = path.resolve(__dirname, "..", "linus.csv");
const outFile = path.resolve(__dirname, "..", "linus-import-ready.csv");

const wb = XLSX.readFile(inFile);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

// Deduplicate by product name (keep first)
const seen = new Set();
const deduped = [];
for (const r of rows) {
  const n = String(r.Product || "").trim();
  if (!n) continue;
  if (seen.has(n.toLowerCase())) continue;
  seen.add(n.toLowerCase());
  deduped.push(r);
}

// Transform
const output = deduped.map((r) => {
  const product = String(r.Product || "").trim();
  const api = String(r.API || "").trim();
  const retail = parseFloat(r.Retail_Price) || 0;
  const cost = parseFloat(r.Cost_Price) || 0;
  const cat = classify(product, api);
  return {
    name: product,
    generic_name: api === product ? "" : api,
    category: cat,
    dispensing_unit: guessUnit(product, api),
    unit_price: retail,
    cost_price: Math.round(cost * 100) / 100,
    quantity_in_stock: 0,
    reorder_level: 10,
    expiry_date: "",
    barcode: barcode(),
    requires_prescription: "FALSE",
  };
});

// Stats
const cats = {};
output.forEach((r) => (cats[r.category] = (cats[r.category] || 0) + 1));
console.log(`\n=== Linus CSV -> Import-Ready Conversion ===`);
console.log(`Input rows:  ${rows.length}`);
console.log(`After dedup: ${deduped.length}`);
console.log(`\nCategory breakdown:`);
Object.entries(cats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

// Write CSV
const owb = XLSX.utils.book_new();
const ows = XLSX.utils.json_to_sheet(output, {
  header: [
    "name",
    "generic_name",
    "category",
    "dispensing_unit",
    "unit_price",
    "cost_price",
    "quantity_in_stock",
    "reorder_level",
    "expiry_date",
    "barcode",
    "requires_prescription",
  ],
});
XLSX.utils.book_append_sheet(owb, ows, "Import");
XLSX.writeFile(owb, outFile, { bookType: "csv" });
console.log(`\nOutput: ${outFile}`);
