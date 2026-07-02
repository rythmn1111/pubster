/**
 * Pubster — Phase-1 seed (docs/DATABASE.md §Seeding).
 *
 * Seeds 3–5 pubs near Boston, MA (test location ~42.3601, -71.0589), each with:
 *   - a mixed table inventory (2× 2-seat, 3× 4-seat, 2× 6-seat),
 *   - a menu (categories → items with priceCents),
 *   - one upcoming event (future startTime, capacity, per-person cover charge).
 * Plus one manager and one staff User (email + argon2 password) on the first pub.
 *
 * Idempotent: clean-then-insert. Safe to re-run (`pnpm --filter @pubster/api prisma db seed`).
 * `Pub.location` (PostGIS geography) is set via raw SQL after each pub is created.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Seeded pub/manager credentials (documented for dashboard testing).
const MANAGER_EMAIL = 'manager@bellinhand.test';
const MANAGER_PASSWORD = 'ManagerPass123!';
const STAFF_EMAIL = 'staff@bellinhand.test';
const STAFF_PASSWORD = 'StaffPass123!';

// Standard opening hours: [ [open, close], ... ] per weekday.
const OPENING_HOURS = {
  mon: [['16:00', '23:30']],
  tue: [['16:00', '23:30']],
  wed: [['16:00', '23:30']],
  thu: [['16:00', '00:30']],
  fri: [['12:00', '01:00']],
  sat: [['12:00', '01:00']],
  sun: [['12:00', '22:00']],
};

interface MenuSeed {
  category: string;
  sortOrder: number;
  items: { name: string; description: string; priceCents: number }[];
}

interface PubSeed {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  addressLine: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  menu: MenuSeed[];
  event: { name: string; description: string; capacity: number; coverChargeCents: number };
}

const PUBS: PubSeed[] = [
  {
    name: 'The Bell in Hand Tavern',
    description: "America's oldest tavern (est. 1795) — hearty pub fare and live music near Faneuil Hall.",
    latitude: 42.3601,
    longitude: -71.057,
    addressLine: '45 Union St',
    city: 'Boston',
    region: 'MA',
    postalCode: '02108',
    phone: '+1-617-227-2098',
    menu: [
      {
        category: 'Starters',
        sortOrder: 0,
        items: [
          { name: 'Loaded Nachos', description: 'Cheddar, jalapeños, pico, sour cream.', priceCents: 1200 },
          { name: 'Buffalo Wings', description: 'Eight wings, blue cheese, celery.', priceCents: 1400 },
          { name: 'Soft Pretzel', description: 'Warm pretzel with beer-cheese dip.', priceCents: 900 },
        ],
      },
      {
        category: 'Mains',
        sortOrder: 1,
        items: [
          { name: 'Classic Burger', description: 'Half-pound patty, cheddar, fries.', priceCents: 1650 },
          { name: 'Fish & Chips', description: 'Beer-battered cod, tartar, slaw.', priceCents: 1850 },
          { name: 'Shepherd’s Pie', description: 'Lamb, root veg, mashed potato crust.', priceCents: 1750 },
        ],
      },
      {
        category: 'Drinks',
        sortOrder: 2,
        items: [
          { name: 'House Lager (pint)', description: 'Crisp local draft.', priceCents: 700 },
          { name: 'IPA (pint)', description: 'New England hazy IPA.', priceCents: 800 },
          { name: 'Soft Drink', description: 'Assorted sodas.', priceCents: 350 },
        ],
      },
    ],
    event: {
      name: 'Live Blues Night',
      description: 'Local blues trio, no reservation fee beyond cover.',
      capacity: 40,
      coverChargeCents: 1500,
    },
  },
  {
    name: 'Cheers Beacon Hill',
    description: 'The iconic Beacon Hill bar — the original "Cheers". Classic American pub food.',
    latitude: 42.3559,
    longitude: -71.0708,
    addressLine: '84 Beacon St',
    city: 'Boston',
    region: 'MA',
    postalCode: '02108',
    phone: '+1-617-227-9605',
    menu: [
      {
        category: 'Small Plates',
        sortOrder: 0,
        items: [
          { name: 'Clam Chowder', description: 'New England style, oyster crackers.', priceCents: 1100 },
          { name: 'Mozzarella Sticks', description: 'Marinara dipping sauce.', priceCents: 1000 },
        ],
      },
      {
        category: 'Entrées',
        sortOrder: 1,
        items: [
          { name: 'Norm’s Burger', description: 'Bacon, cheddar, brioche bun.', priceCents: 1700 },
          { name: 'Turkey Club', description: 'Roast turkey, bacon, fries.', priceCents: 1500 },
          { name: 'Caesar Salad', description: 'Romaine, parmesan, croutons.', priceCents: 1250 },
        ],
      },
    ],
    event: {
      name: 'Trivia Tuesday',
      description: 'Team pub quiz — prizes for the top table.',
      capacity: 32,
      coverChargeCents: 500,
    },
  },
  {
    name: 'The Black Rose',
    description: 'Irish pub in the Financial District with traditional music sessions and Guinness on tap.',
    latitude: 42.3592,
    longitude: -71.0537,
    addressLine: '160 State St',
    city: 'Boston',
    region: 'MA',
    postalCode: '02109',
    phone: '+1-617-742-2286',
    menu: [
      {
        category: 'Starters',
        sortOrder: 0,
        items: [
          { name: 'Potato Boxty', description: 'Irish potato pancakes, chive cream.', priceCents: 1050 },
          { name: 'Scotch Egg', description: 'Sausage-wrapped egg, mustard.', priceCents: 1150 },
        ],
      },
      {
        category: 'Mains',
        sortOrder: 1,
        items: [
          { name: 'Guinness Beef Stew', description: 'Slow-braised beef, root veg, soda bread.', priceCents: 1900 },
          { name: 'Bangers & Mash', description: 'Irish sausage, onion gravy.', priceCents: 1650 },
          { name: 'Corned Beef Sandwich', description: 'Rye, swiss, mustard, fries.', priceCents: 1550 },
        ],
      },
      {
        category: 'Pints',
        sortOrder: 2,
        items: [
          { name: 'Guinness (pint)', description: 'Nitro stout.', priceCents: 850 },
          { name: 'Irish Red (pint)', description: 'Malty amber ale.', priceCents: 800 },
        ],
      },
    ],
    event: {
      name: 'Trad Session',
      description: 'Traditional Irish music session — open floor.',
      capacity: 50,
      coverChargeCents: 1000,
    },
  },
  {
    name: 'Lansdowne Pub',
    description: 'Lively Fenway pub steps from the ballpark — big screens and a large event floor.',
    latitude: 42.3467,
    longitude: -71.0972,
    addressLine: '9 Lansdowne St',
    city: 'Boston',
    region: 'MA',
    postalCode: '02215',
    phone: '+1-617-247-1222',
    menu: [
      {
        category: 'Shareables',
        sortOrder: 0,
        items: [
          { name: 'Loaded Tots', description: 'Bacon, cheese, scallion.', priceCents: 1150 },
          { name: 'Boneless Wings', description: 'Choice of sauce.', priceCents: 1300 },
          { name: 'Spinach Dip', description: 'Warm, with pita chips.', priceCents: 1100 },
        ],
      },
      {
        category: 'Handhelds',
        sortOrder: 1,
        items: [
          { name: 'Fenway Burger', description: 'Double patty, special sauce.', priceCents: 1800 },
          { name: 'Chicken Sandwich', description: 'Crispy chicken, slaw, pickles.', priceCents: 1550 },
        ],
      },
    ],
    event: {
      name: 'Game Day Watch Party',
      description: 'Big-screen watch party with drink specials.',
      capacity: 80,
      coverChargeCents: 2000,
    },
  },
];

async function clean(): Promise<void> {
  // Delete child-to-parent to respect foreign keys.
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.event.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pub.deleteMany();
}

function tableInventory(): { seats: number; label: string }[] {
  const tables: { seats: number; label: string }[] = [];
  // 2× 2-seat, 3× 4-seat, 2× 6-seat = 7 physical tables.
  const plan: [number, number][] = [
    [2, 2],
    [4, 3],
    [6, 2],
  ];
  for (const [seats, qty] of plan) {
    for (let i = 1; i <= qty; i++) {
      tables.push({ seats, label: `${seats}-seat #${i}` });
    }
  }
  return tables;
}

async function main(): Promise<void> {
  await clean();

  // Upcoming event window: 7 days from now, 20:00–23:00 local-ish (UTC stored).
  const eventStart = new Date();
  eventStart.setDate(eventStart.getDate() + 7);
  eventStart.setHours(20, 0, 0, 0);
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(23, 0, 0, 0);

  let firstPubId: string | null = null;

  for (const p of PUBS) {
    const pub = await prisma.pub.create({
      data: {
        name: p.name,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
        addressLine: p.addressLine,
        city: p.city,
        region: p.region,
        postalCode: p.postalCode,
        phone: p.phone,
        photos: [],
        openingHours: OPENING_HOURS,
        slotMinutes: 90,
        tables: { create: tableInventory() },
        events: {
          create: {
            name: p.event.name,
            description: p.event.description,
            startTime: eventStart,
            endTime: eventEnd,
            capacity: p.event.capacity,
            coverChargeCents: p.event.coverChargeCents,
            status: 'scheduled',
          },
        },
      },
    });
    if (firstPubId === null) firstPubId = pub.id;

    // Menu: categories then items (need category ids).
    for (const cat of p.menu) {
      const category = await prisma.menuCategory.create({
        data: { pubId: pub.id, name: cat.category, sortOrder: cat.sortOrder },
      });
      await prisma.menuItem.createMany({
        data: cat.items.map((item, idx) => ({
          pubId: pub.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          isAvailable: true,
          sortOrder: idx,
        })),
      });
    }

    // Sync PostGIS location (lng, lat order) from lat/lng.
    await prisma.$executeRaw`
      UPDATE "Pub"
      SET location = ST_SetSRID(ST_MakePoint(${p.longitude}, ${p.latitude}), 4326)::geography
      WHERE id = ${pub.id};
    `;
  }

  // Staff + manager accounts attached to the first pub.
  const [managerHash, staffHash] = await Promise.all([
    argon2.hash(MANAGER_PASSWORD, { type: argon2.argon2id }),
    argon2.hash(STAFF_PASSWORD, { type: argon2.argon2id }),
  ]);

  await prisma.user.create({
    data: {
      role: 'manager',
      name: 'Bell in Hand Manager',
      email: MANAGER_EMAIL,
      passwordHash: managerHash,
      pubId: firstPubId,
    },
  });
  await prisma.user.create({
    data: {
      role: 'staff',
      name: 'Bell in Hand Staff',
      email: STAFF_EMAIL,
      passwordHash: staffHash,
      pubId: firstPubId,
    },
  });

  // Summary.
  const [pubs, tables, categories, items, events, users] = await Promise.all([
    prisma.pub.count(),
    prisma.restaurantTable.count(),
    prisma.menuCategory.count(),
    prisma.menuItem.count(),
    prisma.event.count(),
    prisma.user.count(),
  ]);
  console.log('Seed complete:');
  console.log(`  pubs=${pubs} tables=${tables} categories=${categories} menuItems=${items} events=${events} users=${users}`);
  console.log(`  manager: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
  console.log(`  staff:   ${STAFF_EMAIL} / ${STAFF_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
