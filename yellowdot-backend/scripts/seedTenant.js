/**
 * seedTenant.js — Seed the Yellow Dot preschool as the first tenant
 *
 * Run once:
 *   node yellowdot-backend/scripts/seedTenant.js
 *
 * This is idempotent — safe to re-run; it will skip if the tenant already exists.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("../firebaseAdmin"); // initialise Admin SDK

const tenantSvc = require("../services/tenantService");

async function main() {
  const TENANT_ID = process.env.SCHOOL_ID || "yd-main";

  const existing = await tenantSvc.getById(TENANT_ID);
  if (existing) {
    console.log(`✓ Tenant '${TENANT_ID}' already exists — skipping.`);
    process.exit(0);
  }

  const tenant = await tenantSvc.create(
    {
      tenantId:        TENANT_ID,
      schoolName:      "Yellow Dot Preschool",
      subscriptionPlan: "professional",
      contactEmail:    "admin@yellowdot.in",
      contactPhone:    "",
      address:         "",
      city:            "Sea Woods",
      country:         "India",
      timezone:        "Asia/Kolkata",
      currency:        "INR",
      branches: [
        {
          branchId: `${TENANT_ID}-main`,
          name:     "Main Campus",
          address:  "",
          centerId: "",
        },
      ],
      academicYears: [
        {
          yearId:    "ay-2024-25",
          label:     "2024–25",
          startDate: "2024-04-01",
          endDate:   "2025-03-31",
          current:   false,
        },
        {
          yearId:    "ay-2025-26",
          label:     "2025–26",
          startDate: "2025-04-01",
          endDate:   "2026-03-31",
          current:   true,
        },
      ],
    },
    { actorUserId: "system", actorEmail: "system" },
  );

  // Override status to active (not trial) since this is the existing production school
  await tenantSvc.setStatus(TENANT_ID, "active", {
    actorUserId: "system",
    actorEmail:  "system",
    reason:      "Existing production school — migrated to tenant model",
  });

  console.log(`✓ Tenant '${TENANT_ID}' created:`, tenant.schoolName);
  process.exit(0);
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
