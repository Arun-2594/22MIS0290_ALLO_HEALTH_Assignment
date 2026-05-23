import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central Hub",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi Distribution Center",
        location: "New Delhi, Delhi",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Bangalore Tech Park",
        location: "Bangalore, Karnataka",
      },
    }),
  ]);

  console.log(`✅ Created ${warehouses.length} warehouses`);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "iPhone 15 Pro",
        description:
          "Apple iPhone 15 Pro with A17 Pro chip, 48MP camera system, and titanium design. Available in Natural Titanium.",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium",
      },
    }),
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5",
        description:
          "Industry-leading noise canceling headphones with Auto NC Optimizer, crystal-clear hands-free calling, and 30-hour battery life.",
        imageUrl: "https://m.media-amazon.com/images/I/51aXvjzcukL._SL1500_.jpg",
      },
    }),
    prisma.product.create({
      data: {
        name: 'MacBook Pro 14"',
        description:
          "Apple MacBook Pro with M3 Pro chip, 18GB unified memory, 512GB SSD, and Liquid Retina XDR display.",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy S24 Ultra",
        description:
          "Galaxy AI powered smartphone with S Pen, 200MP camera, and titanium frame. The ultimate Galaxy experience.",
        imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/in/2401/gallery/in-galaxy-s24-ultra-sm-s928bztdins-thumb-539573527",
      },
    }),
    prisma.product.create({
      data: {
        name: "iPad Air M2",
        description:
          "Supercharged by M2 chip. 11-inch Liquid Retina display, all-day battery life, and support for Apple Pencil Pro.",
        imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/ipad-air-select-wifi-blue-202403",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // Create stock records — varied quantities, some intentionally low for 409 demos
  const stockData: { productIdx: number; warehouseIdx: number; total: number }[] = [
    // iPhone 15 Pro — low stock in Mumbai, decent elsewhere
    { productIdx: 0, warehouseIdx: 0, total: 2 },
    { productIdx: 0, warehouseIdx: 1, total: 15 },
    { productIdx: 0, warehouseIdx: 2, total: 8 },
    // Sony WH-1000XM5 — good stock everywhere
    { productIdx: 1, warehouseIdx: 0, total: 25 },
    { productIdx: 1, warehouseIdx: 1, total: 30 },
    { productIdx: 1, warehouseIdx: 2, total: 20 },
    // MacBook Pro — very low stock
    { productIdx: 2, warehouseIdx: 0, total: 1 },
    { productIdx: 2, warehouseIdx: 1, total: 3 },
    { productIdx: 2, warehouseIdx: 2, total: 1 },
    // Samsung Galaxy S24 Ultra — moderate stock
    { productIdx: 3, warehouseIdx: 0, total: 10 },
    { productIdx: 3, warehouseIdx: 1, total: 12 },
    { productIdx: 3, warehouseIdx: 2, total: 7 },
    // iPad Air M2 — one warehouse out of stock
    { productIdx: 4, warehouseIdx: 0, total: 0 },
    { productIdx: 4, warehouseIdx: 1, total: 18 },
    { productIdx: 4, warehouseIdx: 2, total: 5 },
  ];

  const stocks = await Promise.all(
    stockData.map((s) =>
      prisma.stock.create({
        data: {
          productId: products[s.productIdx].id,
          warehouseId: warehouses[s.warehouseIdx].id,
          total: s.total,
          reserved: 0,
        },
      })
    )
  );

  console.log(`✅ Created ${stocks.length} stock records`);
  console.log("\n📊 Stock summary:");

  for (const product of products) {
    console.log(`\n  ${product.name}:`);
    for (const warehouse of warehouses) {
      const stock = stocks.find(
        (s) => s.productId === product.id && s.warehouseId === warehouse.id
      );
      console.log(`    ${warehouse.name}: ${stock?.total ?? 0} units`);
    }
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
