// Populates the database with a minimal but realistic dataset so a new
// developer (or evaluator) can exercise every module immediately after
// cloning the repo. Safe to re-run: it wipes and recreates its own data.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const DarkStore = require('../models/DarkStore');
const Product = require('../models/Product');
const StoreStock = require('../models/StoreStock');
const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');

async function seed() {
  await connectDB();

  console.log('[seed] clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    DarkStore.deleteMany({}),
    Product.deleteMany({}),
    StoreStock.deleteMany({}),
    DeliveryPartner.deleteMany({}),
    Order.deleteMany({}),
  ]);

  console.log('[seed] creating dark stores...');
  const [koramangala, indiranagar] = await DarkStore.create([
    {
      name: 'Koramangala Dark Store',
      area: 'Koramangala, Bengaluru',
      location: { type: 'Point', coordinates: [77.6245, 12.9352] },
      serviceablePincodes: ['560034', '560095'],
    },
    {
      name: 'Indiranagar Dark Store',
      area: 'Indiranagar, Bengaluru',
      location: { type: 'Point', coordinates: [77.6408, 12.9784] },
      serviceablePincodes: ['560038', '560008'],
    },
  ]);

  console.log('[seed] creating products...');
  const products = await Product.create([
    { name: 'Amul Toned Milk 500ml', category: 'Dairy', price: 27, unit: 'pack' },
    { name: 'Whole Wheat Bread', category: 'Bakery', price: 45, unit: 'pack' },
    { name: 'Basmati Rice 1kg', category: 'Staples', price: 120, unit: 'kg' },
    { name: 'Farm Fresh Eggs (6 pcs)', category: 'Dairy', price: 60, unit: 'pack' },
    { name: 'Bananas', category: 'Fruits & Vegetables', price: 40, unit: 'kg' },
    { name: 'Tomatoes', category: 'Fruits & Vegetables', price: 30, unit: 'kg' },
    { name: 'Curd 400g', category: 'Dairy', price: 38, unit: 'pack' },
    { name: 'Paneer 200g', category: 'Dairy', price: 92, unit: 'pack' },
    { name: 'Brown Bread', category: 'Bakery', price: 50, unit: 'pack' },
    { name: 'Oats 500g', category: 'Staples', price: 85, unit: 'pack' },
    { name: 'Toor Dal 1kg', category: 'Staples', price: 145, unit: 'kg' },
    { name: 'Onions', category: 'Fruits & Vegetables', price: 42, unit: 'kg' },
    { name: 'Potatoes', category: 'Fruits & Vegetables', price: 36, unit: 'kg' },
    { name: 'Spinach', category: 'Fruits & Vegetables', price: 25, unit: 'bunch' },
    { name: 'Salted Potato Chips', category: 'Snacks', price: 30, unit: 'pack' },
    { name: 'Roasted Peanuts', category: 'Snacks', price: 55, unit: 'pack' },
    { name: 'Orange Juice 1L', category: 'Beverages', price: 110, unit: 'bottle' },
    { name: 'Sparkling Water 750ml', category: 'Beverages', price: 45, unit: 'bottle' },
  ]);

  console.log('[seed] seeding per-store stock...');
  const stockDocs = [];
  for (const store of [koramangala, indiranagar]) {
    for (const product of products) {
      stockDocs.push({
        storeId: store._id,
        productId: product._id,
        quantity: 50,
        reorderPoint: 10,
      });
    }
  }
  // Deliberately push one item below its reorder point so the
  // low-stock-alerts endpoint (module 9) has something to return out of the box.
  stockDocs[0].quantity = 5;
  await StoreStock.create(stockDocs);

  console.log('[seed] creating users (all passwords: Password123!)...');
  const passwordHash = await User.hashPassword('Password123!');

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@grocery.test',
    passwordHash,
    role: 'admin',
  });

  const storeStaff = await User.create({
    name: 'Koramangala Staff',
    email: 'staff.koramangala@grocery.test',
    passwordHash,
    role: 'store_staff',
    assignedStore: koramangala._id,
  });

  const customer = await User.create({
    name: 'Priya Sharma',
    email: 'customer@grocery.test',
    passwordHash,
    role: 'customer',
    phone: '9876543210',
    defaultAddress: {
      line1: '12, 4th Cross, Koramangala',
      area: 'Koramangala',
      pincode: '560034',
      location: { type: 'Point', coordinates: [77.6245, 12.9352] },
    },
  });

  const deliveryUser = await User.create({
    name: 'Ravi Kumar',
    email: 'delivery@grocery.test',
    passwordHash,
    role: 'delivery_partner',
    phone: '9876500000',
  });
  await DeliveryPartner.create({ userId: deliveryUser._id, isAvailable: true, vehicleType: 'bike' });

  console.log('[seed] done.');
  console.log('[seed] sample accounts:');
  console.log(`  admin:         ${admin.email} / Password123!`);
  console.log(`  store staff:   ${storeStaff.email} / Password123!`);
  console.log(`  customer:      ${customer.email} / Password123!`);
  console.log(`  delivery:      ${deliveryUser.email} / Password123!`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
