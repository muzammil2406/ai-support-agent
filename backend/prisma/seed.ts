/**
 * Database seeder — run with: npx prisma db seed
 *
 * 1. Creates demo users (customer / support_agent / admin) — idempotent.
 * 2. Recreates fake orders for the demo customer.
 * 3. Recreates the FAQ knowledge base and generates embeddings (one at a
 *    time — never batched, keeping memory flat).
 * 4. Ensures the pgvector extension + ivfflat index exist.
 *
 * Embeddings use gemini-embedding-001 trimmed to 768 dims (outputDimensionality)
 * to match the pgvector column. text-embedding-004 is no longer available on
 * new Google AI keys.
 *
 * Env required: DATABASE_URL, GOOGLE_API_KEY (loaded from backend/.env by the
 * Prisma CLI; `import 'dotenv/config'` covers direct `npm run seed`).
 */

import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();

const EMBEDDING_DIMENSIONS = 768;

async function embedQuery(text: string): Promise<number[]> {
  const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const model = client.getGenerativeModel({
    model: process.env.EMBEDDINGS_MODEL ?? 'gemini-embedding-001',
  });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: EMBEDDING_DIMENSIONS,
  } as unknown as Parameters<typeof model.embedContent>[0]);
  return result.embedding.values;
}

// ── Demo users ──────────────────────────────────────────────────────────────
const DEMO_PASSWORD = 'password123';

interface SeedUser {
  email: string;
  name: string;
  role: 'customer' | 'support_agent' | 'admin';
}

const USERS: SeedUser[] = [
  { email: 'demo@stellar.dev', name: 'Demo Customer', role: 'customer' },
  { email: 'support@stellar.dev', name: 'Support Agent', role: 'support_agent' },
  { email: 'admin@stellar.dev', name: 'Admin', role: 'admin' },
];

// ── Fake orders for the demo customer ───────────────────────────────────────
interface SeedOrder {
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  total: number;
  itemCount: number;
  createdAt: Date;
}

const ORDERS: SeedOrder[] = [
  { orderNumber: 'ORD-1001', status: 'delivered', total: 89.99, itemCount: 2, createdAt: new Date('2026-05-12T10:24:00Z') },
  { orderNumber: 'ORD-1002', status: 'shipped', total: 149.5, itemCount: 3, createdAt: new Date('2026-06-03T14:02:00Z') },
  { orderNumber: 'ORD-1003', status: 'processing', total: 42.0, itemCount: 1, createdAt: new Date('2026-06-21T09:47:00Z') },
  { orderNumber: 'ORD-1004', status: 'delivered', total: 214.75, itemCount: 4, createdAt: new Date('2026-04-02T18:30:00Z') },
  { orderNumber: 'ORD-1005', status: 'cancelled', total: 63.2, itemCount: 2, createdAt: new Date('2026-05-28T11:15:00Z') },
  { orderNumber: 'ORD-1006', status: 'shipped', total: 35.99, itemCount: 1, createdAt: new Date('2026-06-27T16:40:00Z') },
  { orderNumber: 'ORD-1007', status: 'refunded', total: 118.4, itemCount: 2, createdAt: new Date('2026-04-19T08:05:00Z') },
  { orderNumber: 'ORD-1008', status: 'processing', total: 76.8, itemCount: 3, createdAt: new Date('2026-07-01T12:33:00Z') },
  { orderNumber: 'ORD-1009', status: 'delivered', total: 302.0, itemCount: 5, createdAt: new Date('2026-03-15T19:12:00Z') },
  { orderNumber: 'ORD-1010', status: 'pending', total: 27.49, itemCount: 1, createdAt: new Date('2026-07-05T07:58:00Z') },
];

// ── FAQ knowledge base (~18 entries, matches the pgvector 768-dim column) ───
interface FaqSeed {
  question: string;
  answer: string;
  category: string;
}

const FAQ: FaqSeed[] = [
  {
    question: 'How long does standard shipping take?',
    answer:
      'Standard shipping takes 3-5 business days within the US and 7-12 business days internationally. Express (2-day) and overnight options are available at checkout.',
    category: 'shipping',
  },
  {
    question: 'How much does shipping cost?',
    answer:
      'Orders over $50 ship free with standard shipping. Below that, standard is $5.99, express is $12.99, and overnight is $24.99. International rates are calculated at checkout.',
    category: 'shipping',
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'Yes, we ship to over 40 countries. International delivery takes 7-12 business days. Import duties and taxes are calculated and displayed at checkout before you pay.',
    category: 'shipping',
  },
  {
    question: 'Can I track my order?',
    answer:
      'Yes. Once your order ships, we email a tracking link. You can also ask for the status anytime in this chat by giving us your order number (e.g. ORD-1002).',
    category: 'orders',
  },
  {
    question: 'My order status has not changed in days. Is something wrong?',
    answer:
      'Some carriers only scan parcels at major hubs, so status updates can lag 24-48 hours. If your order is in "processing" for more than 5 business days, escalate and we will look into it.',
    category: 'orders',
  },
  {
    question: 'Can I change or cancel my order after placing it?',
    answer:
      'You can cancel or change an order as long as it has not shipped yet. Orders that are already "processing" can still be cancelled within 24 hours of purchase.',
    category: 'orders',
  },
  {
    question: 'What is your return policy?',
    answer:
      'You have 30 days from delivery to request a return for a full refund, no questions asked. Items must be unused and in original packaging. Some final-sale items are excluded.',
    category: 'returns',
  },
  {
    question: 'How do I start a return?',
    answer:
      'Tell us your order number and we will email you a prepaid return label. Drop the package at any USPS location — refunds are issued within 5 business days of the label being scanned.',
    category: 'returns',
  },
  {
    question: 'How long does a refund take to appear on my card?',
    answer:
      'Once the return is scanned, refunds take 3-5 business days to reach most credit cards and 5-10 business days for PayPal and bank transfers.',
    category: 'returns',
  },
  {
    question: 'Can I exchange an item instead of returning it?',
    answer:
      'Yes. Start a return with your order number and choose "exchange". Exchanges ship free once we receive the original item back.',
    category: 'returns',
  },
  {
    question: 'Why was I charged twice?',
    answer:
      'This is usually a temporary authorization hold. The duplicate charge clears automatically within 3-5 business days. If it does not, escalate with your order number and we will investigate.',
    category: 'billing',
  },
  {
    question: 'Can I get a receipt or invoice for my order?',
    answer:
      'Yes — give us your order number and we will email a copy of the receipt. VAT invoices for business customers are also available on request.',
    category: 'billing',
  },
  {
    question: 'Which payment methods do you accept?',
    answer:
      'We accept Visa, Mastercard, American Express, PayPal, Apple Pay, Google Pay, and Shop Pay. We do not accept personal checks or money orders.',
    category: 'billing',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Use the "Forgot password" link on the login page. We email a secure reset link that expires after 30 minutes.',
    category: 'account',
  },
  {
    question: 'How do I update my shipping address?',
    answer:
      'You can update your address in Account Settings before an order ships. If an order is already in transit, we can only redirect it to a post office pickup.',
    category: 'account',
  },
  {
    question: 'Is my payment information secure?',
    answer:
      'Yes. All transactions are encrypted with TLS 1.3 and processed by PCI-DSS Level 1 certified payment providers. We never store full card numbers on our servers.',
    category: 'account',
  },
  {
    question: 'What is your warranty on electronics?',
    answer:
      'All electronics come with a 1-year limited warranty covering defects in materials and workmanship. Extended 2-year and 3-year plans are offered at checkout.',
    category: 'warranty',
  },
  {
    question: 'My product arrived damaged. What should I do?',
    answer:
      'We are sorry about that. Send us your order number and a photo of the damage and we will ship a replacement within 1-2 business days — you do not need to return the damaged item.',
    category: 'returns',
  },
  {
    question: 'How do I care for my cast iron cookware?',
    answer:
      'Hand wash with warm water, dry completely, and apply a thin coat of cooking oil after each use. Avoid soap on a well-seasoned pan and never put it in the dishwasher.',
    category: 'product',
  },
  {
    question: 'Are your products tested on animals?',
    answer:
      'No. All beauty and personal care products are certified cruelty-free and most are vegan. Look for the cruelty-free badge on each product page.',
    category: 'product',
  },
];

async function ensurePgVector(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS faq_entries_embedding_idx
      ON faq_entries USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10)
  `);
}

async function seedUsers(): Promise<{ demoCustomerId: string }> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let demoCustomerId = '';
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, name: u.name, password: hash, role: u.role },
    });
    if (u.role === 'customer') demoCustomerId = user.id;
    console.log(`✔ user ${u.email} (${u.role}) — password "${DEMO_PASSWORD}"`);
  }
  return { demoCustomerId };
}

async function seedOrders(demoCustomerId: string): Promise<void> {
  await prisma.order.deleteMany({});
  await prisma.order.createMany({
    data: ORDERS.map((o) => ({
      ...o,
      userId: demoCustomerId,
    })),
  });
  console.log(`✔ seeded ${ORDERS.length} orders`);
}

async function seedFaq(): Promise<void> {
  await prisma.faqEntry.deleteMany({});

  let created = 0;
  for (const entry of FAQ) {
    const faq = await prisma.faqEntry.create({
      data: {
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
      },
    });

    // Embed one entry at a time — memory stays flat.
    const vector = await embedQuery(
      `${entry.category}\nQ: ${entry.question}\nA: ${entry.answer}`,
    );
    const vectorLiteral = `[${vector.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE faq_entries SET embedding = CAST($1 AS vector) WHERE id = $2`,
      vectorLiteral,
      faq.id,
    );
    created += 1;
    console.log(`✔ faq ${created}/${FAQ.length}: "${entry.question.slice(0, 50)}…"`);
  }
  console.log(`✔ embedded ${created} FAQ entries (${FAQ.length} total)`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding AI Support Agent database…');
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is required to generate FAQ embeddings.');
  }

  const { demoCustomerId } = await seedUsers();
  await seedOrders(demoCustomerId);
  await ensurePgVector();
  await seedFaq();

  console.log('✅ Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
