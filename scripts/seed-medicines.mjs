// =============================================
// LK PHARMACARE — Seed 50 Common Medicines
// Run: node scripts/seed-medicines.mjs
// =============================================

const SUPABASE_URL = "https://nsiqypahijzspufafaii.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zaXF5cGFoaWp6c3B1ZmFmYWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEyNzc3NSwiZXhwIjoyMDg3NzAzNzc1fQ.b-2c9jP8SEIsMmYRhvby5AbpBfRZ-bvvY628Av5OEjU";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers,
    ...options,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// 50 real-world medicines across all categories
const MEDICINES = [
  // --- Painkillers ---
  {
    name: "Paracetamol 500mg",
    generic_name: "Acetaminophen",
    category: "Painkillers",
    unit_price: 50,
    cost_price: 25,
    quantity_in_stock: 500,
    reorder_level: 50,
    barcode: "5000000001001",
    requires_prescription: false,
    expiry_date: "2027-06-30",
  },
  {
    name: "Ibuprofen 400mg",
    generic_name: "Ibuprofen",
    category: "Painkillers",
    unit_price: 80,
    cost_price: 40,
    quantity_in_stock: 350,
    reorder_level: 40,
    barcode: "5000000001002",
    requires_prescription: false,
    expiry_date: "2027-09-15",
  },
  {
    name: "Diclofenac 50mg",
    generic_name: "Diclofenac Sodium",
    category: "Painkillers",
    unit_price: 120,
    cost_price: 60,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000001003",
    requires_prescription: false,
    expiry_date: "2027-04-20",
  },
  {
    name: "Aspirin 300mg",
    generic_name: "Acetylsalicylic Acid",
    category: "Painkillers",
    unit_price: 45,
    cost_price: 20,
    quantity_in_stock: 400,
    reorder_level: 50,
    barcode: "5000000001004",
    requires_prescription: false,
    expiry_date: "2027-12-01",
  },
  {
    name: "Tramadol 50mg",
    generic_name: "Tramadol HCl",
    category: "Painkillers",
    unit_price: 250,
    cost_price: 150,
    quantity_in_stock: 100,
    reorder_level: 20,
    barcode: "5000000001005",
    requires_prescription: true,
    expiry_date: "2027-03-15",
  },

  // --- Antibiotics ---
  {
    name: "Amoxicillin 500mg",
    generic_name: "Amoxicillin",
    category: "Antibiotics",
    unit_price: 150,
    cost_price: 80,
    quantity_in_stock: 300,
    reorder_level: 40,
    barcode: "5000000002001",
    requires_prescription: true,
    expiry_date: "2027-05-30",
  },
  {
    name: "Azithromycin 250mg",
    generic_name: "Azithromycin",
    category: "Antibiotics",
    unit_price: 350,
    cost_price: 200,
    quantity_in_stock: 150,
    reorder_level: 25,
    barcode: "5000000002002",
    requires_prescription: true,
    expiry_date: "2027-08-20",
  },
  {
    name: "Ciprofloxacin 500mg",
    generic_name: "Ciprofloxacin HCl",
    category: "Antibiotics",
    unit_price: 200,
    cost_price: 100,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000002003",
    requires_prescription: true,
    expiry_date: "2027-07-10",
  },
  {
    name: "Metronidazole 400mg",
    generic_name: "Metronidazole",
    category: "Antibiotics",
    unit_price: 100,
    cost_price: 50,
    quantity_in_stock: 250,
    reorder_level: 35,
    barcode: "5000000002004",
    requires_prescription: true,
    expiry_date: "2027-11-25",
  },
  {
    name: "Doxycycline 100mg",
    generic_name: "Doxycycline Hyclate",
    category: "Antibiotics",
    unit_price: 180,
    cost_price: 90,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000002005",
    requires_prescription: true,
    expiry_date: "2027-10-15",
  },

  // --- Antihistamines ---
  {
    name: "Cetirizine 10mg",
    generic_name: "Cetirizine HCl",
    category: "Antihistamines",
    unit_price: 80,
    cost_price: 35,
    quantity_in_stock: 300,
    reorder_level: 40,
    barcode: "5000000003001",
    requires_prescription: false,
    expiry_date: "2027-09-30",
  },
  {
    name: "Loratadine 10mg",
    generic_name: "Loratadine",
    category: "Antihistamines",
    unit_price: 90,
    cost_price: 40,
    quantity_in_stock: 250,
    reorder_level: 35,
    barcode: "5000000003002",
    requires_prescription: false,
    expiry_date: "2027-08-15",
  },
  {
    name: "Chlorpheniramine 4mg",
    generic_name: "Chlorphenamine Maleate",
    category: "Antihistamines",
    unit_price: 60,
    cost_price: 25,
    quantity_in_stock: 400,
    reorder_level: 50,
    barcode: "5000000003003",
    requires_prescription: false,
    expiry_date: "2027-07-20",
  },
  {
    name: "Fexofenadine 120mg",
    generic_name: "Fexofenadine HCl",
    category: "Antihistamines",
    unit_price: 150,
    cost_price: 80,
    quantity_in_stock: 150,
    reorder_level: 20,
    barcode: "5000000003004",
    requires_prescription: false,
    expiry_date: "2028-01-10",
  },

  // --- Antacids ---
  {
    name: "Omeprazole 20mg",
    generic_name: "Omeprazole",
    category: "Antacids",
    unit_price: 120,
    cost_price: 55,
    quantity_in_stock: 300,
    reorder_level: 40,
    barcode: "5000000004001",
    requires_prescription: false,
    expiry_date: "2027-06-15",
  },
  {
    name: "Ranitidine 150mg",
    generic_name: "Ranitidine HCl",
    category: "Antacids",
    unit_price: 90,
    cost_price: 40,
    quantity_in_stock: 250,
    reorder_level: 35,
    barcode: "5000000004002",
    requires_prescription: false,
    expiry_date: "2027-10-30",
  },
  {
    name: "Antacid Suspension 200ml",
    generic_name: "Aluminium Hydroxide + Magnesium",
    category: "Antacids",
    unit_price: 180,
    cost_price: 90,
    quantity_in_stock: 120,
    reorder_level: 20,
    barcode: "5000000004003",
    requires_prescription: false,
    expiry_date: "2027-12-20",
  },
  {
    name: "Esomeprazole 40mg",
    generic_name: "Esomeprazole Magnesium",
    category: "Antacids",
    unit_price: 200,
    cost_price: 110,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000004004",
    requires_prescription: false,
    expiry_date: "2027-11-10",
  },

  // --- Antifungals ---
  {
    name: "Fluconazole 150mg",
    generic_name: "Fluconazole",
    category: "Antifungals",
    unit_price: 200,
    cost_price: 100,
    quantity_in_stock: 150,
    reorder_level: 20,
    barcode: "5000000005001",
    requires_prescription: true,
    expiry_date: "2027-08-25",
  },
  {
    name: "Clotrimazole Cream 1%",
    generic_name: "Clotrimazole",
    category: "Antifungals",
    unit_price: 250,
    cost_price: 120,
    quantity_in_stock: 100,
    reorder_level: 15,
    barcode: "5000000005002",
    requires_prescription: false,
    expiry_date: "2027-09-15",
  },
  {
    name: "Ketoconazole 200mg",
    generic_name: "Ketoconazole",
    category: "Antifungals",
    unit_price: 300,
    cost_price: 170,
    quantity_in_stock: 80,
    reorder_level: 15,
    barcode: "5000000005003",
    requires_prescription: true,
    expiry_date: "2027-05-20",
  },
  {
    name: "Nystatin Oral Drops",
    generic_name: "Nystatin",
    category: "Antifungals",
    unit_price: 350,
    cost_price: 200,
    quantity_in_stock: 60,
    reorder_level: 10,
    barcode: "5000000005004",
    requires_prescription: true,
    expiry_date: "2027-07-30",
  },

  // --- Cardiovascular ---
  {
    name: "Amlodipine 5mg",
    generic_name: "Amlodipine Besylate",
    category: "Cardiovascular",
    unit_price: 150,
    cost_price: 70,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000006001",
    requires_prescription: true,
    expiry_date: "2027-10-01",
  },
  {
    name: "Atenolol 50mg",
    generic_name: "Atenolol",
    category: "Cardiovascular",
    unit_price: 120,
    cost_price: 55,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000006002",
    requires_prescription: true,
    expiry_date: "2027-11-20",
  },
  {
    name: "Enalapril 10mg",
    generic_name: "Enalapril Maleate",
    category: "Cardiovascular",
    unit_price: 130,
    cost_price: 60,
    quantity_in_stock: 160,
    reorder_level: 25,
    barcode: "5000000006003",
    requires_prescription: true,
    expiry_date: "2027-09-10",
  },
  {
    name: "Losartan 50mg",
    generic_name: "Losartan Potassium",
    category: "Cardiovascular",
    unit_price: 180,
    cost_price: 95,
    quantity_in_stock: 140,
    reorder_level: 20,
    barcode: "5000000006004",
    requires_prescription: true,
    expiry_date: "2027-12-15",
  },

  // --- Diabetes ---
  {
    name: "Metformin 500mg",
    generic_name: "Metformin HCl",
    category: "Diabetes",
    unit_price: 100,
    cost_price: 45,
    quantity_in_stock: 350,
    reorder_level: 50,
    barcode: "5000000007001",
    requires_prescription: true,
    expiry_date: "2027-08-30",
  },
  {
    name: "Glibenclamide 5mg",
    generic_name: "Glyburide",
    category: "Diabetes",
    unit_price: 80,
    cost_price: 35,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000007002",
    requires_prescription: true,
    expiry_date: "2027-07-15",
  },
  {
    name: "Insulin Mixtard 100IU/ml",
    generic_name: "Human Insulin (Mixed)",
    category: "Diabetes",
    unit_price: 1500,
    cost_price: 900,
    quantity_in_stock: 50,
    reorder_level: 10,
    barcode: "5000000007003",
    requires_prescription: true,
    expiry_date: "2027-04-01",
  },
  {
    name: "Glimepiride 2mg",
    generic_name: "Glimepiride",
    category: "Diabetes",
    unit_price: 150,
    cost_price: 75,
    quantity_in_stock: 120,
    reorder_level: 20,
    barcode: "5000000007004",
    requires_prescription: true,
    expiry_date: "2027-06-20",
  },

  // --- Respiratory ---
  {
    name: "Salbutamol Inhaler 100mcg",
    generic_name: "Albuterol",
    category: "Respiratory",
    unit_price: 450,
    cost_price: 250,
    quantity_in_stock: 80,
    reorder_level: 15,
    barcode: "5000000008001",
    requires_prescription: true,
    expiry_date: "2027-09-25",
  },
  {
    name: "Prednisolone 5mg",
    generic_name: "Prednisolone",
    category: "Respiratory",
    unit_price: 120,
    cost_price: 55,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000008002",
    requires_prescription: true,
    expiry_date: "2027-11-30",
  },
  {
    name: "Cough Syrup 100ml",
    generic_name: "Dextromethorphan + Guaifenesin",
    category: "Respiratory",
    unit_price: 250,
    cost_price: 130,
    quantity_in_stock: 150,
    reorder_level: 25,
    barcode: "5000000008003",
    requires_prescription: false,
    expiry_date: "2027-10-10",
  },
  {
    name: "Bromhexine 8mg",
    generic_name: "Bromhexine HCl",
    category: "Respiratory",
    unit_price: 80,
    cost_price: 35,
    quantity_in_stock: 220,
    reorder_level: 30,
    barcode: "5000000008004",
    requires_prescription: false,
    expiry_date: "2027-08-15",
  },

  // --- Vitamins & Supplements ---
  {
    name: "Vitamin C 1000mg",
    generic_name: "Ascorbic Acid",
    category: "Vitamins & Supplements",
    unit_price: 200,
    cost_price: 100,
    quantity_in_stock: 400,
    reorder_level: 50,
    barcode: "5000000009001",
    requires_prescription: false,
    expiry_date: "2028-03-01",
  },
  {
    name: "Multivitamin Tablets",
    generic_name: "Multivitamin Complex",
    category: "Vitamins & Supplements",
    unit_price: 350,
    cost_price: 180,
    quantity_in_stock: 300,
    reorder_level: 40,
    barcode: "5000000009002",
    requires_prescription: false,
    expiry_date: "2028-06-15",
  },
  {
    name: "Iron + Folic Acid",
    generic_name: "Ferrous Sulphate + Folic Acid",
    category: "Vitamins & Supplements",
    unit_price: 150,
    cost_price: 70,
    quantity_in_stock: 250,
    reorder_level: 35,
    barcode: "5000000009003",
    requires_prescription: false,
    expiry_date: "2027-12-30",
  },
  {
    name: "Vitamin D3 1000IU",
    generic_name: "Cholecalciferol",
    category: "Vitamins & Supplements",
    unit_price: 300,
    cost_price: 160,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000009004",
    requires_prescription: false,
    expiry_date: "2028-02-15",
  },
  {
    name: "Zinc Sulphate 20mg",
    generic_name: "Zinc Sulphate",
    category: "Vitamins & Supplements",
    unit_price: 100,
    cost_price: 45,
    quantity_in_stock: 350,
    reorder_level: 45,
    barcode: "5000000009005",
    requires_prescription: false,
    expiry_date: "2028-01-20",
  },

  // --- Dermatology ---
  {
    name: "Hydrocortisone Cream 1%",
    generic_name: "Hydrocortisone",
    category: "Dermatology",
    unit_price: 200,
    cost_price: 100,
    quantity_in_stock: 120,
    reorder_level: 20,
    barcode: "5000000010001",
    requires_prescription: false,
    expiry_date: "2027-08-10",
  },
  {
    name: "Betamethasone Cream",
    generic_name: "Betamethasone Valerate",
    category: "Dermatology",
    unit_price: 280,
    cost_price: 150,
    quantity_in_stock: 90,
    reorder_level: 15,
    barcode: "5000000010002",
    requires_prescription: true,
    expiry_date: "2027-09-20",
  },
  {
    name: "Calamine Lotion 100ml",
    generic_name: "Calamine + Zinc Oxide",
    category: "Dermatology",
    unit_price: 150,
    cost_price: 70,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000010003",
    requires_prescription: false,
    expiry_date: "2027-11-05",
  },
  {
    name: "Antifungal Skin Cream 30g",
    generic_name: "Miconazole Nitrate",
    category: "Dermatology",
    unit_price: 220,
    cost_price: 110,
    quantity_in_stock: 100,
    reorder_level: 15,
    barcode: "5000000010004",
    requires_prescription: false,
    expiry_date: "2027-10-20",
  },

  // --- Gastrointestinal ---
  {
    name: "ORS Sachets (Pack of 10)",
    generic_name: "Oral Rehydration Salts",
    category: "Gastrointestinal",
    unit_price: 100,
    cost_price: 40,
    quantity_in_stock: 500,
    reorder_level: 60,
    barcode: "5000000011001",
    requires_prescription: false,
    expiry_date: "2028-06-01",
  },
  {
    name: "Loperamide 2mg",
    generic_name: "Loperamide HCl",
    category: "Gastrointestinal",
    unit_price: 80,
    cost_price: 35,
    quantity_in_stock: 200,
    reorder_level: 30,
    barcode: "5000000011002",
    requires_prescription: false,
    expiry_date: "2027-07-25",
  },
  {
    name: "Buscopan 10mg",
    generic_name: "Hyoscine Butylbromide",
    category: "Gastrointestinal",
    unit_price: 150,
    cost_price: 80,
    quantity_in_stock: 180,
    reorder_level: 25,
    barcode: "5000000011003",
    requires_prescription: false,
    expiry_date: "2027-09-30",
  },
  {
    name: "Domperidone 10mg",
    generic_name: "Domperidone",
    category: "Gastrointestinal",
    unit_price: 100,
    cost_price: 50,
    quantity_in_stock: 220,
    reorder_level: 30,
    barcode: "5000000011004",
    requires_prescription: false,
    expiry_date: "2027-11-15",
  },

  // --- Eye & Ear ---
  {
    name: "Chloramphenicol Eye Drops",
    generic_name: "Chloramphenicol",
    category: "Eye & Ear",
    unit_price: 200,
    cost_price: 100,
    quantity_in_stock: 80,
    reorder_level: 15,
    barcode: "5000000012001",
    requires_prescription: true,
    expiry_date: "2027-06-10",
  },
  {
    name: "Ciprofloxacin Eye Drops",
    generic_name: "Ciprofloxacin",
    category: "Eye & Ear",
    unit_price: 250,
    cost_price: 130,
    quantity_in_stock: 60,
    reorder_level: 10,
    barcode: "5000000012002",
    requires_prescription: true,
    expiry_date: "2027-07-20",
  },
  {
    name: "Ear Wax Drops 10ml",
    generic_name: "Sodium Bicarbonate",
    category: "Eye & Ear",
    unit_price: 150,
    cost_price: 70,
    quantity_in_stock: 100,
    reorder_level: 15,
    barcode: "5000000012003",
    requires_prescription: false,
    expiry_date: "2027-12-01",
  },
];

async function main() {
  console.log("🌱 Seeding 50 medicines into LK PharmaCare...\n");

  // 1. Get the "Main Branch" ID
  console.log("📍 Fetching Main Branch...");
  const branches = await supabaseFetch("/branches?select=id,name&limit=10");

  if (!branches || branches.length === 0) {
    console.error("❌ No branches found! Creating Main Branch...");
    const [newBranch] = await supabaseFetch("/branches", {
      method: "POST",
      body: JSON.stringify({ name: "Main Branch", location: "Nairobi, Kenya" }),
    });
    branches.push(newBranch);
  }

  const mainBranch =
    branches.find((b) => b.name === "Main Branch") || branches[0];
  console.log(`✅ Using branch: ${mainBranch.name} (${mainBranch.id})\n`);

  // 2. Get an admin user for created_by
  console.log("👤 Fetching admin user...");
  const users = await supabaseFetch(
    "/users?select=id,full_name,role&role=eq.admin&limit=1",
  );
  const adminId = users && users.length > 0 ? users[0].id : null;
  if (adminId) {
    console.log(`✅ Admin: ${users[0].full_name}\n`);
  } else {
    console.log("⚠️  No admin user found, created_by will be null\n");
  }

  // 3. Delete existing seeded medicines (by barcode prefix) to avoid duplicates
  console.log("🗑️  Clearing previously seeded medicines...");
  await supabaseFetch("/medicines?barcode=like.500000000*", {
    method: "DELETE",
  }).catch(() => {});

  // 4. Insert medicines
  const medicinesWithBranch = MEDICINES.map((med) => ({
    ...med,
    branch_id: mainBranch.id,
    created_by: adminId,
  }));

  console.log(`💊 Inserting ${medicinesWithBranch.length} medicines...`);

  // Insert in batches of 10
  let inserted = 0;
  for (let i = 0; i < medicinesWithBranch.length; i += 10) {
    const batch = medicinesWithBranch.slice(i, i + 10);
    const result = await supabaseFetch("/medicines", {
      method: "POST",
      body: JSON.stringify(batch),
    });
    inserted += result.length;
    console.log(
      `  ✅ Batch ${Math.floor(i / 10) + 1}: ${result.length} medicines added`,
    );
  }

  console.log(`\n🎉 Done! ${inserted} medicines seeded successfully.`);
  console.log("\nBreakdown by category:");

  const categoryCounts = {};
  for (const med of MEDICINES) {
    categoryCounts[med.category] = (categoryCounts[med.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
