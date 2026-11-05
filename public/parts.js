/* ============================================
   WattsMyBudget: parts catalog
   Source: PC Express Dealer's Price List, dated Wed, Nov 4, 2026
           (www.pcx.com.ph). Prices are in Philippine pesos (PHP).
   School project demo. Not a real store; dealer prices, not retail.

   HOW TO EDIT
   - Each category lists parts from CHEAPEST to MOST EXPENSIVE.
     The build engine relies on that order.
   - watts      = power draw (CPU and GPU only). Used to pick the power supply.
   - minCooler  = (CPU only) position of the weakest cooler that is allowed.
                  0 = first cooler in the list, 1 = second, and so on.
   - All CPUs are AM5 and all boards are AM5 + DDR5, so any combination fits.
   - Ryzen 9000 chips on the cheapest board may need a BIOS update.
   ============================================ */
window.PARTS_DATA = {
    source: { name: "PC Express Dealer's Price List", date: 'Nov 4, 2026', url: 'https://pcx.com.ph/pages/download-pc-express-pricelist' },

    cpu: { label: 'CPU', items: [
        { name: 'AMD Ryzen 5 7500F (OEM)',  spec: '6 cores / 12 threads, AM5, no cooler', price: 9600,  watts: 65,  minCooler: 0 },
        { name: 'AMD Ryzen 5 7600',         spec: '6 cores / 12 threads, AM5',            price: 13050, watts: 65,  minCooler: 0 },
        { name: 'AMD Ryzen 5 9600X',        spec: '6 cores / 12 threads, AM5',            price: 15400, watts: 65,  minCooler: 1 },
        { name: 'AMD Ryzen 7 9700X',        spec: '8 cores / 16 threads, AM5',            price: 22350, watts: 65,  minCooler: 1 },
        { name: 'AMD Ryzen 9 9900X',        spec: '12 cores / 24 threads, AM5',           price: 27700, watts: 120, minCooler: 2 },
        { name: 'AMD Ryzen 7 9800X3D',      spec: '8 cores, 3D V-Cache, AM5',             price: 32800, watts: 120, minCooler: 2 },
        { name: 'AMD Ryzen 9 9950X',        spec: '16 cores / 32 threads, AM5',           price: 38900, watts: 170, minCooler: 4 }
    ]},

    gpu: { label: 'Graphics card', items: [
        { name: 'Zotac GeForce RTX 3050 Gaming Twin Edge',   spec: '6 GB',        price: 14900,  watts: 70 },
        { name: 'Zotac GeForce RTX 5060 Solo',               spec: '8 GB GDDR7',  price: 19850,  watts: 145 },
        { name: 'Gigabyte Radeon RX 9060 XT Gaming OC',      spec: '16 GB',       price: 29000,  watts: 160 },
        { name: 'Colorful GeForce RTX 5060 Ti Gaming Duo OC', spec: '16 GB GDDR7', price: 34500,  watts: 180 },
        { name: 'Gigabyte Radeon RX 9070 XT Gaming OC',      spec: '16 GB',       price: 49500,  watts: 304 },
        { name: 'Inno3D GeForce RTX 5070 Twin X2',           spec: '12 GB GDDR7', price: 60500,  watts: 250 },
        { name: 'Inno3D GeForce RTX 5070 Ti X3',             spec: '16 GB GDDR7', price: 72350,  watts: 300 },
        { name: 'MSI GeForce RTX 5080 Shadow 3X OC',         spec: '16 GB GDDR7', price: 145000, watts: 360 }
    ]},

    ram: { label: 'Memory', items: [
        { name: '16 GB DDR5-5600 (Dahua)',        spec: 'DDR5, 5600 MT/s', price: 14000 },
        { name: '32 GB DDR5-5600 (Lexar)',        spec: 'DDR5, 5600 MT/s', price: 32000 },
        { name: '64 GB DDR5-6000 (Teamgroup RGB)', spec: 'DDR5, 6000 MT/s, 2 x 32 GB', price: 70000 }
    ]},

    storage: { label: 'Storage', items: [
        { name: 'Kingston NV3 500 GB NVMe SSD', spec: 'M.2 NVMe', price: 6350 },
        { name: 'Kingston NV3 1 TB NVMe SSD',   spec: 'M.2 NVMe', price: 10200 },
        { name: 'Kingston NV3 2 TB NVMe SSD',   spec: 'M.2 NVMe', price: 19500 },
        { name: 'Kingston NV3 4 TB NVMe SSD',   spec: 'M.2 NVMe', price: 34000 }
    ]},

    board: { label: 'Motherboard', items: [
        { name: 'Asus A620MK (CSM)',          spec: 'AM5, DDR5',         price: 5750 },
        { name: 'Gigabyte B650M Gaming WiFi', spec: 'AM5, DDR5, WiFi',   price: 7050 },
        { name: 'Gigabyte B650M Gaming X',    spec: 'AM5, DDR5',         price: 11850 },
        { name: 'MSI B850 Gaming Plus WiFi',  spec: 'AM5, DDR5, WiFi',   price: 13700 },
        { name: 'Gigabyte X870 Gaming X',     spec: 'AM5, DDR5',         price: 16700 },
        { name: 'Gigabyte X870 Aorus Elite ICE', spec: 'AM5, DDR5',      price: 20900 }
    ]},

    case: { label: 'Case', items: [
        { name: 'Antec AX20 Elite',            spec: 'Mid-tower',  price: 2050 },
        { name: 'NZXT H7 Flow',                spec: 'Mid-tower',  price: 3150 },
        { name: 'Asus TUF Gaming GT301',       spec: 'Mid-tower',  price: 4850 },
        { name: 'Asus GT502 RGB (Black)',      spec: 'Mid-tower',  price: 8900 },
        { name: 'Asus ROG Strix Helios GX601 (Black)', spec: 'Full tower', price: 16900 }
    ]},

    cooler: { label: 'CPU cooler', items: [
        { name: 'Gamdias Boreas E1-210',          spec: 'Air cooler',          price: 450 },
        { name: 'Cooler Master Hyper 212 Spectrum V3', spec: 'Air cooler',     price: 1300 },
        { name: 'Cooler Master Hyper 620S',       spec: 'Dual-tower air cooler', price: 2300 },
        { name: 'Thermaltake TH240',              spec: '240 mm liquid cooler', price: 4900 },
        { name: 'DeepCool LQ360',                 spec: '360 mm liquid cooler', price: 7400 }
    ]},

    // The power supply is not chosen by budget. The engine picks the cheapest one
    // that covers CPU watts + GPU watts + 150 W of headroom.
    psu: { label: 'Power supply', items: [
        { name: 'MSI MAG 550 W Bronze',        spec: '80+ Bronze',  price: 2850, watts: 550 },
        { name: 'MSI MAG 650 W Bronze',        spec: '80+ Bronze',  price: 3400, watts: 650 },
        { name: 'MSI MAG ATX 3.1 GN 750 W',    spec: 'ATX 3.1',     price: 4950, watts: 750 },
        { name: 'MSI MAG ATX 3.1 GN 850 W',    spec: 'ATX 3.1',     price: 5950, watts: 850 },
        { name: 'MSI MAG ATX 3.1 GL 1000 W',   spec: 'ATX 3.1, modular', price: 9250, watts: 1000 }
    ]}
};