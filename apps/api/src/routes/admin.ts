import bcrypt from "bcryptjs";
import { Hono } from "hono";
import {
  AdminLoginRequest,
  BulkVendorsRequest,
  CreateRestaurantRequest,
  CreateTablesRequest,
  CreateVenueRequest,
  MenuSyncRequest,
  QrListQuery,
  SetVendorOpenRequest,
  SettlementsQuery,
  UpdateVendorRequest,
  UpdateVenueRequest,
  isMultivendor,
  type AdminVenueDetailResponse,
  type BulkVendorInput,
  type CreateRestaurantResponse,
  type OrderFlow,
  type Vendor,
  type AdminVenuesResponse,
  type BulkVendorsResponse,
  type GoLiveResponse,
  type ManagerPinResponse,
  type MenuSyncResponse,
  type PosVendorsResponse,
  type QrListResponse,
  type QrListRow,
  type ResetPinResponse,
  type TablesResponse,
  type Venue,
} from "@one/contracts";
import { COLLECTION_NAMES, db, newId, newPin, newQrToken, NO_ID, type VendorDoc } from "@one/db";
import { mockPosAdapter } from "../adapters";
import { config } from "../config";
import { clearAdminSession, requireAdmin, safeEqual, setAdminSession } from "../lib/auth";
import { AppError, parse } from "../lib/errors";
import { nowIso } from "../lib/time";
import { syncVendorMenu } from "../services/menu-sync";
import { accentFor, assignLetter, uniqueSlug, venueCodeCandidates } from "../services/naming";
import { completeStep, getRun, startRun } from "../services/onboarding";
import { getVendorDoc, getVenue, listVendors, toVendor } from "../services/repo";
import { dashboard, settlements } from "../services/stats";

export const admin = new Hono();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

admin.post("/admin/login", async (c) => {
  const { password } = parse(AdminLoginRequest, await c.req.json().catch(() => null));
  if (!safeEqual(password, config.adminPassword)) throw new AppError("UNAUTHORIZED", 401, "Wrong password");
  setAdminSession(c);
  return c.json({ ok: true });
});

admin.post("/admin/logout", (c) => {
  clearAdminSession(c);
  return c.json({ ok: true });
});

// everything below needs the admin cookie
admin.use("/admin/*", async (c, next) => {
  if (c.req.path === "/v1/admin/login" || c.req.path === "/v1/admin/logout") return next();
  requireAdmin(c);
  await next();
});

admin.get("/admin/me", (c) => c.json({ ok: true }));

const tableUrl = (qrToken: string) => `${config.publicCustomerUrl}/t/${qrToken}`;

async function counts(venueId: string) {
  const d = await db();
  const vendors = await d.vendors.find({ venueId }, { projection: { _id: 0, id: 1 } }).toArray();
  const [tableCount, itemCount] = await Promise.all([
    d.tables.countDocuments({ venueId }),
    d.menuItems.countDocuments({ vendorId: { $in: vendors.map((v) => v.id) } }),
  ]);
  return { vendorCount: vendors.length, tableCount, itemCount };
}

/* ── venues ── */

admin.get("/admin/venues", async (c) => {
  const d = await db();
  const venues = await d.venues.find({}, NO_ID).sort({ createdAt: -1 }).toArray();
  const body: AdminVenuesResponse = { venues: await Promise.all(venues.map(async (venue) => ({ venue, ...(await counts(venue.id)) }))) };
  return c.json(body);
});

/** Inserts a draft venue with a unique code + slug and starts its onboarding run. */
async function insertVenue(req: CreateVenueRequest) {
  const d = await db();
  const existing = await d.venues.find({}, { projection: { _id: 0, code: 1, slug: 1 } }).toArray();
  const usedCodes = new Set(existing.map((v) => v.code));
  const usedSlugs = new Set(existing.map((v) => v.slug));
  const code = venueCodeCandidates(req.name).find((x) => !usedCodes.has(x)) ?? `V${Date.now() % 100000}`;
  const venue: Venue = {
    id: newId("ven"),
    name: req.name,
    slug: uniqueSlug(req.name, usedSlugs),
    code,
    type: req.type,
    flow: req.flow,
    gateway: req.gateway,
    gatewayMerchantId: req.gatewayMerchantId || null,
    currency: req.currency,
    timezone: req.timezone,
    feeBps: req.feeBps,
    status: "draft",
    setupDurationMs: null,
    createdAt: nowIso(),
  };
  await d.venues.insertOne({ ...venue });
  const run = await startRun(venue.id);
  return { venue, run };
}

/** PAT reads the open bill from the POS, so every vendor must be POS-connected. */
function assertFlowFits(flow: OrderFlow, vendors: Pick<Vendor, "name" | "posMode">[]) {
  if (flow !== "pat") return;
  const tablet = vendors.filter((v) => v.posMode !== "mock_pos").map((v) => v.name);
  if (tablet.length) {
    throw new AppError("VALIDATION_ERROR", 400, `Pay at table needs every vendor on a POS — ${tablet.join(", ")} ${tablet.length === 1 ? "uses" : "use"} a tablet`);
  }
}

/** Creates vendors with unique letters/slugs and one-time PINs. Caller validates names. */
async function insertVendors(venueId: string, inputs: BulkVendorInput[], existing: VendorDoc[]) {
  const letters = new Set(existing.map((v) => v.letter));
  const slugs = new Set(existing.map((v) => v.slug));
  let sort = existing.reduce((m, v) => Math.max(m, v.sortOrder + 1), 0);
  const pins: BulkVendorsResponse["pins"] = [];
  const docs: VendorDoc[] = [];
  for (const v of inputs) {
    const letter = assignLetter(v.name, letters);
    letters.add(letter);
    const slug = uniqueSlug(v.name, slugs);
    slugs.add(slug);
    const pin = newPin();
    const doc: VendorDoc = {
      id: newId("vdr"),
      venueId,
      name: v.name,
      slug,
      letter,
      emoji: v.emoji || "🍽️",
      accentToken: v.accentToken ?? accentFor(sort),
      posMode: v.posMode,
      posVendorId: v.posMode === "mock_pos" ? v.posVendorId ?? null : null,
      isOpen: true,
      sortOrder: sort++,
      feeBps: null,
      pinHash: await bcrypt.hash(pin, 8),
    };
    docs.push(doc);
    pins.push({ vendorId: doc.id, name: doc.name, pin });
  }
  const d = await db();
  if (docs.length) await d.vendors.insertMany(docs.map((x) => ({ ...x })));
  return { docs, pins };
}

admin.post("/admin/venues", async (c) => {
  const req = parse(CreateVenueRequest, await c.req.json().catch(() => null));
  const { venue, run } = await insertVenue(req);
  return c.json({ venue, onboardingRun: run }, 201);
});

/**
 * Single restaurant in one call: venue (type restaurant) + its one vendor + menu sync + table QRs, then live.
 * Menu/POS trouble doesn't roll back — the restaurant is created and the error is reported.
 */
admin.post("/admin/restaurants", async (c) => {
  const req = parse(CreateRestaurantRequest, await c.req.json().catch(() => null));
  if (req.posMode === "mock_pos" && !req.posVendorId) throw new AppError("VALIDATION_ERROR", 400, "Pick the POS this restaurant uses");
  assertFlowFits(req.flow, [{ name: req.name, posMode: req.posMode }]);
  const d = await db();
  if (req.posVendorId && (await d.vendors.countDocuments({ posVendorId: req.posVendorId }))) {
    throw new AppError("CONFLICT", 409, `POS vendor ${req.posVendorId} is already linked to another restaurant`);
  }

  const { venue } = await insertVenue({
    name: req.name,
    type: "restaurant",
    flow: req.flow,
    gateway: req.gateway,
    gatewayMerchantId: req.gatewayMerchantId,
    feeBps: req.feeBps,
    currency: "AED",
    timezone: "Asia/Dubai",
  });
  const { docs, pins } = await insertVendors(venue.id, [{ name: req.name, emoji: req.emoji, posMode: req.posMode, posVendorId: req.posVendorId }], []);
  const vendor = toVendor(docs[0]!);
  await completeStep(venue.id, "vendors");

  const sync = await syncVendorMenu(vendor);
  await completeStep(venue.id, "menus");

  if (req.tableCount > 0) {
    await d.tables.insertMany(
      Array.from({ length: req.tableCount }, (_, i) => ({ id: newId("tbl"), venueId: venue.id, label: `T${i + 1}`, qrToken: newQrToken(), vendorId: null })),
    );
  }
  await completeStep(venue.id, "tables");

  // live only once guests have something to scan and order from
  let live = venue;
  if (req.tableCount > 0 && sync.itemCount > 0) {
    const run = await completeStep(venue.id, "live");
    const setupDurationMs = run ? new Date(run.finishedAt ?? nowIso()).getTime() - new Date(run.startedAt).getTime() : 0;
    live = (await d.venues.findOneAndUpdate({ id: venue.id }, { $set: { status: "live", setupDurationMs } }, { returnDocument: "after", projection: { _id: 0 } }))!;
  }
  const body: CreateRestaurantResponse = {
    venue: live,
    vendor,
    pin: pins[0]!.pin,
    itemCount: sync.itemCount,
    tableCount: req.tableCount,
    menuError: sync.ok ? (sync.itemCount ? null : "The menu is empty") : sync.error,
  };
  return c.json(body, 201);
});

admin.get("/admin/venues/:id", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const d = await db();
  const vendors = await listVendors(venue.id);
  const itemCounts = await d.menuItems
    .aggregate<{ _id: string; n: number }>([{ $match: { vendorId: { $in: vendors.map((v) => v.id) } } }, { $group: { _id: "$vendorId", n: { $sum: 1 } } }])
    .toArray();
  const byVendor = new Map(itemCounts.map((x) => [x._id, x.n]));
  const body: AdminVenueDetailResponse = {
    venue,
    vendors: vendors.map((v) => ({ ...v, itemCount: byVendor.get(v.id) ?? 0 })),
    tableCount: await d.tables.countDocuments({ venueId: venue.id }),
    itemCount: itemCounts.reduce((a, x) => a + x.n, 0),
    onboardingRun: await getRun(venue.id),
    baselineMinPerVendor: config.baselineMinPerVendor,
    hasManagerPin: (await d.venueManagers.countDocuments({ venueId: venue.id })) > 0,
  };
  return c.json(body);
});

admin.patch("/admin/venues/:id", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const req = parse(UpdateVenueRequest, await c.req.json().catch(() => null));
  const vendors = await listVendors(venue.id);
  if (req.type && isMultivendor(req.type) !== isMultivendor(venue.type)) {
    if (req.type === "restaurant" && vendors.length > 1) {
      throw new AppError("CONFLICT", 409, `A restaurant has one vendor — this venue has ${vendors.length}`);
    }
  }
  if (req.flow) assertFlowFits(req.flow, vendors);
  if (req.gatewayMerchantId === "") req.gatewayMerchantId = null;
  const d = await db();
  const updated = await d.venues.findOneAndUpdate({ id: venue.id }, { $set: req }, { returnDocument: "after", projection: { _id: 0 } });
  return c.json({ venue: updated });
});

/* ── vendors ── */

admin.get("/admin/pos/vendors", async (c) => {
  try {
    const body: PosVendorsResponse = { vendors: await mockPosAdapter.listVendors() };
    return c.json(body);
  } catch (err) {
    throw new AppError("POS_ERROR", 502, `Couldn't reach the POS directory (${err instanceof Error ? err.message : "error"})`);
  }
});

admin.post("/admin/venues/:id/vendors/bulk", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const req = parse(BulkVendorsRequest, await c.req.json().catch(() => null));
  const d = await db();
  const existing = await d.vendors.find({ venueId: venue.id }, NO_ID).toArray();
  if (venue.type === "restaurant" && existing.length + req.vendors.length > 1) {
    throw new AppError("CONFLICT", 409, "A restaurant has exactly one vendor — make it a food court or hotel to add more");
  }
  assertFlowFits(venue.flow, req.vendors);

  const names = new Set(existing.map((v) => v.name.toLowerCase()));
  const problems: string[] = [];
  for (const v of req.vendors) {
    if (names.has(v.name.toLowerCase())) problems.push(`Duplicate vendor name "${v.name}"`);
    names.add(v.name.toLowerCase());
    if (v.posMode === "mock_pos" && !v.posVendorId) problems.push(`"${v.name}" needs a POS vendor id`);
  }
  if (problems.length) throw new AppError("VALIDATION_ERROR", 400, problems.join("; "), { problems });

  const { docs, pins } = await insertVendors(venue.id, req.vendors, existing);
  await completeStep(venue.id, "vendors");
  const body: BulkVendorsResponse = { vendors: docs.map(toVendor), pins };
  return c.json(body, 201);
});

admin.post("/admin/vendors/:vendorId/open", async (c) => {
  const v = await getVendorDoc(c.req.param("vendorId"));
  const { isOpen } = parse(SetVendorOpenRequest, await c.req.json().catch(() => null));
  const d = await db();
  await d.vendors.updateOne({ id: v.id }, { $set: { isOpen } });
  return c.json(toVendor({ ...v, isOpen }));
});

/** Multivendor venue manager login for the vendor panel. Shown once; resetting invalidates the old PIN. */
admin.post("/admin/venues/:id/manager-pin", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  if (!isMultivendor(venue.type)) throw new AppError("VALIDATION_ERROR", 400, "A single restaurant logs in as its vendor — no manager login needed");
  const pin = newPin();
  const d = await db();
  await d.venueManagers.updateOne({ venueId: venue.id }, { $set: { pinHash: await bcrypt.hash(pin, 8), updatedAt: nowIso() } }, { upsert: true });
  const body: ManagerPinResponse = { venueId: venue.id, pin };
  return c.json(body);
});

/** Restaurant / vendor settings: name, emoji, POS link, commission override. */
admin.patch("/admin/vendors/:vendorId", async (c) => {
  const v = await getVendorDoc(c.req.param("vendorId"));
  const req = parse(UpdateVendorRequest, await c.req.json().catch(() => null));
  const venue = await getVenue(v.venueId);
  const d = await db();
  const set: Partial<VendorDoc> = {};
  if (req.name !== undefined && req.name !== v.name) {
    if (await d.vendors.countDocuments({ venueId: v.venueId, id: { $ne: v.id }, name: { $regex: `^${escapeRegex(req.name)}$`, $options: "i" } })) {
      throw new AppError("CONFLICT", 409, `"${req.name}" already exists in this venue`);
    }
    set.name = req.name;
  }
  if (req.emoji !== undefined) set.emoji = req.emoji;
  if (req.feeBps !== undefined) set.feeBps = req.feeBps;
  const posMode = req.posMode ?? v.posMode;
  if (req.posMode !== undefined || req.posVendorId !== undefined) {
    const posVendorId = posMode === "mock_pos" ? (req.posVendorId === undefined ? v.posVendorId : req.posVendorId) : null;
    if (posMode === "mock_pos" && !posVendorId) throw new AppError("VALIDATION_ERROR", 400, "Pick the POS vendor");
    if (posVendorId && posVendorId !== v.posVendorId && (await d.vendors.countDocuments({ posVendorId, id: { $ne: v.id } }))) {
      throw new AppError("CONFLICT", 409, `POS vendor ${posVendorId} is already linked to another vendor`);
    }
    set.posMode = posMode;
    set.posVendorId = posVendorId;
  }
  if (posMode !== "mock_pos" && venue.flow === "pat") assertFlowFits("pat", [{ name: v.name, posMode }]);
  if (Object.keys(set).length) await d.vendors.updateOne({ id: v.id }, { $set: set });
  // a single restaurant's name is its venue's name
  if (set.name && venue.type === "restaurant") await d.venues.updateOne({ id: venue.id }, { $set: { name: set.name } });
  return c.json(toVendor({ ...v, ...set }));
});

admin.post("/admin/vendors/:vendorId/reset-pin", async (c) => {
  const v = await getVendorDoc(c.req.param("vendorId"));
  const pin = newPin();
  const d = await db();
  await d.vendors.updateOne({ id: v.id }, { $set: { pinHash: await bcrypt.hash(pin, 8) } });
  const body: ResetPinResponse = { vendorId: v.id, pin };
  return c.json(body);
});

/** Only while the venue is a draft — fixes wizard mistakes. */
admin.delete("/admin/vendors/:vendorId", async (c) => {
  const v = await getVendorDoc(c.req.param("vendorId"));
  const venue = await getVenue(v.venueId);
  if (venue.status !== "draft") throw new AppError("CONFLICT", 409, "Can't delete vendors from a live venue — close them instead");
  const d = await db();
  await Promise.all([d.vendors.deleteOne({ id: v.id }), d.menuItems.deleteMany({ vendorId: v.id })]);
  return c.json({ ok: true });
});

/* ── menus ── */

admin.post("/admin/venues/:id/menus/sync", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const req = parse(MenuSyncRequest, await c.req.json().catch(() => ({})));
  const vendors = (await listVendors(venue.id)).filter((v) => !req.vendorIds || req.vendorIds.includes(v.id));
  if (!vendors.length) throw new AppError("VALIDATION_ERROR", 400, "Add vendors before syncing menus");
  const results = await Promise.all(vendors.map(syncVendorMenu));
  await completeStep(venue.id, "menus");
  const body: MenuSyncResponse = {
    results,
    totalItems: results.reduce((a, r) => a + r.itemCount, 0),
    errors: results.filter((r) => !r.ok).length,
  };
  return c.json(body);
});

/* ── tables ── */

admin.get("/admin/venues/:id/tables", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const d = await db();
  const tables = await d.tables.find({ venueId: venue.id }, NO_ID).toArray();
  tables.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const body: TablesResponse = { tables: tables.map((t) => ({ ...t, url: tableUrl(t.qrToken) })) };
  return c.json(body);
});

/** Draft venue: replaces the table set. Live venue: appends (existing printed QRs keep working). */
admin.post("/admin/venues/:id/tables", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const { count, prefix, vendorId } = parse(CreateTablesRequest, await c.req.json().catch(() => null));
  const d = await db();
  if (vendorId) {
    const vendor = await d.vendors.findOne({ id: vendorId, venueId: venue.id }, NO_ID);
    if (!vendor) throw new AppError("VALIDATION_ERROR", 400, "That vendor isn't part of this venue");
  }
  // shared QRs and each vendor's QRs are numbered (and, for drafts, replaced) independently
  const scope = { venueId: venue.id, vendorId: vendorId ?? null };
  let start = 1;
  if (venue.status === "draft") await d.tables.deleteMany(scope);
  else start = (await d.tables.countDocuments(scope)) + 1;
  const tables = Array.from({ length: count }, (_, i) => ({
    id: newId("tbl"),
    venueId: venue.id,
    label: `${prefix}${start + i}`,
    qrToken: newQrToken(),
    vendorId: vendorId ?? null,
  }));
  await d.tables.insertMany(tables.map((t) => ({ ...t })));
  await completeStep(venue.id, "tables");
  const all = await d.tables.find({ venueId: venue.id }, NO_ID).toArray();
  all.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const body: TablesResponse = { tables: all.map((t) => ({ ...t, url: tableUrl(t.qrToken) })) };
  return c.json(body, 201);
});

/* ── QR manager (all venues) ── */

/**
 * QRs across venues: one venue (`venue` = code or slug), a subset (`venueIds`), or every venue combined.
 * Sorted by venue name then table label (numeric-aware), paginated over the combined result.
 */
admin.get("/admin/qr/list", async (c) => {
  const q = parse(QrListQuery, c.req.query());
  const d = await db();

  const match: Record<string, unknown> = {};
  if (q.venue) {
    const venue = await d.venues.findOne({ $or: [{ code: q.venue.toUpperCase() }, { slug: q.venue.toLowerCase() }] }, NO_ID);
    if (!venue) throw new AppError("VALIDATION_ERROR", 400, `No venue with code or slug "${q.venue}"`);
    if (q.venueIds && !q.venueIds.includes(venue.id)) throw new AppError("VALIDATION_ERROR", 400, `"${q.venue}" is not in the selected venues`);
    match.venueId = venue.id;
  } else if (q.venueIds) {
    match.venueId = { $in: q.venueIds };
  }
  if (q.vendor === "shared") match.vendorId = null;
  else if (q.vendor === "individual") match.vendorId = { $type: "string" };
  else if (q.vendor) {
    const venueId = typeof match.venueId === "string" ? match.venueId : undefined;
    const vendor = await d.vendors.findOne(
      { $or: [{ id: q.vendor }, ...(venueId ? [{ venueId, slug: q.vendor.toLowerCase() }] : [])] },
      NO_ID,
    );
    if (!vendor || (venueId && vendor.venueId !== venueId)) {
      throw new AppError("VALIDATION_ERROR", 400, `"${q.vendor}" is not a vendor of ${venueId ? "this venue" : "any venue (pass venue= to use a slug)"}`);
    }
    match.vendorId = vendor.id;
  }
  if (q.ids) match.id = { $in: q.ids };
  if (q.tableName) match.label = { $regex: escapeRegex(q.tableName), $options: "i" };
  if (q.tableId) match.qrToken = { $regex: escapeRegex(q.tableId), $options: "i" };

  const [res] = await d.tables
    .aggregate<{ rows: Omit<QrListRow, "url">[]; total: { n: number }[] }>(
      [
        { $match: match },
        { $lookup: { from: COLLECTION_NAMES.venues, localField: "venueId", foreignField: "id", as: "venue" } },
        { $unwind: "$venue" },
        { $lookup: { from: COLLECTION_NAMES.vendors, localField: "vendorId", foreignField: "id", as: "vendor" } },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        // shared venue QRs first, then each vendor in its venue order
        { $addFields: { vendorSort: { $ifNull: ["$vendor.sortOrder", -1] } } },
        { $sort: { "venue.name": 1, vendorSort: 1, label: 1, id: 1 } },
        {
          $facet: {
            rows: [
              { $skip: q.page * q.limit },
              { $limit: q.limit },
              {
                $project: {
                  _id: 0,
                  id: 1,
                  venueId: 1,
                  label: 1,
                  qrToken: 1,
                  venue: { id: "$venue.id", name: "$venue.name", code: "$venue.code", slug: "$venue.slug", type: "$venue.type" },
                  vendorId: { $ifNull: ["$vendorId", null] },
                  vendor: {
                    $cond: [
                      { $ifNull: ["$vendor.id", false] },
                      { id: "$vendor.id", name: "$vendor.name", slug: "$vendor.slug", emoji: "$vendor.emoji" },
                      null,
                    ],
                  },
                },
              },
            ],
            total: [{ $count: "n" }],
          },
        },
      ],
      { collation: { locale: "en", numericOrdering: true } },
    )
    .toArray();

  const body: QrListResponse = {
    rows: (res?.rows ?? []).map((t) => ({ ...t, url: tableUrl(t.qrToken) })),
    count: res?.total[0]?.n ?? 0,
    page: q.page,
    limit: q.limit,
  };
  return c.json(body);
});

/* ── go live ── */

admin.post("/admin/venues/:id/go-live", async (c) => {
  const venue = await getVenue(c.req.param("id"));
  const { vendorCount, tableCount, itemCount } = await counts(venue.id);
  const missing = [!vendorCount && "vendors", !itemCount && "menu items", !tableCount && "tables"].filter(Boolean);
  if (missing.length) throw new AppError("VALIDATION_ERROR", 400, `Add ${missing.join(", ")} before going live`);
  const run = await completeStep(venue.id, "live");
  const setupDurationMs =
    venue.setupDurationMs ?? (run ? new Date(run.finishedAt ?? nowIso()).getTime() - new Date(run.startedAt).getTime() : 0);
  const d = await db();
  const updated = await d.venues.findOneAndUpdate(
    { id: venue.id },
    { $set: { status: "live", setupDurationMs } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  const body: GoLiveResponse = { venue: updated!, setupDurationMs, baselineMinPerVendor: config.baselineMinPerVendor, vendorCount };
  return c.json(body);
});

/* ── numbers ── */

admin.get("/admin/venues/:id/dashboard", async (c) => c.json(await dashboard(c.req.param("id"))));

admin.get("/admin/venues/:id/settlements", async (c) => {
  const q = parse(SettlementsQuery, { vendorId: c.req.query("vendorId") || undefined, type: c.req.query("type") || undefined });
  return c.json(await settlements(c.req.param("id"), q));
});

