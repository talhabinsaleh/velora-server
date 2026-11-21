import type { Category } from "../src/models/Service";

export interface SeedService {
  serviceName: string;
  category: Category;
  description: string;
  price: number;
  duration: number;
  image: string;
  status?: "active" | "inactive";
}

// Photos are from Unsplash (free license), uploaded to ImgBB at 1600px, the same way admin uploads are stored
export const SERVICES: SeedService[] = [
  {
    serviceName: "Signature Cut & Blow-Dry",
    category: "Haircut & Styling",
    description:
      "A consultation-led haircut shaped to your face and hair texture, finished with a smooth, bouncy blow-dry. Includes a relaxing wash, conditioning rinse and styling tips you can repeat at home.",
    price: 45,
    duration: 60,
    image: "https://i.ibb.co/WpkwsHTg/velora-signature-cut.jpg",
  },
  {
    serviceName: "Men's Precision Cut & Style",
    category: "Haircut & Styling",
    description:
      "Clean fades, sharp lines or a classic scissor cut, tailored to how you wear your hair. Finished with a hot towel and a light hold product so you walk out looking sharp.",
    price: 30,
    duration: 45,
    image: "https://i.ibb.co/QjxrRHNj/velora-mens-cut.jpg",
  },
  {
    serviceName: "Volume Blowout",
    category: "Haircut & Styling",
    description:
      "A wash and round-brush blowout for glossy, long-lasting volume. Perfect before a dinner, a meeting or a photo shoot. Heat protection is always applied first.",
    price: 35,
    duration: 45,
    image: "https://i.ibb.co/VXnN8T5/velora-blowout.jpg",
  },
  {
    serviceName: "Soft Waves & Curls Styling",
    category: "Haircut & Styling",
    description:
      "Effortless beach waves or defined Hollywood curls created with professional irons, set to last all evening. Ideal for weddings, parties and special occasions.",
    price: 40,
    duration: 50,
    image: "https://i.ibb.co/7JRvJqWF/velora-curls.jpg",
  },
  {
    serviceName: "Hand-Painted Balayage",
    category: "Hair Coloring",
    description:
      "Sun-kissed, natural-looking dimension painted by hand for a soft grow-out. Includes toner, a bond-building treatment and a blow-dry finish so your color stays healthy and bright.",
    price: 160,
    duration: 180,
    image: "https://i.ibb.co/fd3VjQcf/velora-balayage.jpg",
  },
  {
    serviceName: "Root Touch-Up",
    category: "Hair Coloring",
    description:
      "Seamless coverage for regrowth and grey hair, matched precisely to your existing shade. A quick, gentle color service followed by a nourishing rinse and style.",
    price: 55,
    duration: 75,
    image: "https://i.ibb.co/t7r5WJH/velora-roots.jpg",
  },
  {
    serviceName: "Full Global Color",
    category: "Hair Coloring",
    description:
      "One rich, even shade from root to tip, from warm chocolate to cool espresso. Uses ammonia-free color with a gloss finish for shine that lasts for weeks.",
    price: 90,
    duration: 120,
    image: "https://i.ibb.co/Tqbmr5zK/velora-global.jpg",
  },
  {
    serviceName: "Pastel Fashion Color",
    category: "Hair Coloring",
    description:
      "Lavender, rose gold or icy silver: playful fashion shades applied over pre-lightened hair. Includes a strand test and an aftercare plan to keep the tone vivid.",
    price: 180,
    duration: 210,
    image: "https://i.ibb.co/vKg3ZzJ/velora-pastel.jpg",
  },
  {
    serviceName: "Keratin Smoothing Treatment",
    category: "Hair Treatment",
    description:
      "Tames frizz and cuts drying time in half for up to three months. The formaldehyde-free keratin treatment leaves hair silky, shiny and easy to manage in humid weather.",
    price: 140,
    duration: 150,
    image: "https://i.ibb.co/nMcB6P0N/velora-keratin.jpg",
  },
  {
    serviceName: "Scalp Detox Ritual",
    category: "Hair Treatment",
    description:
      "A deep-cleansing scalp exfoliation, steam and pressure-point massage that removes buildup and refreshes the roots. Great for oily scalps, flakes or simply a reset.",
    price: 50,
    duration: 45,
    image: "https://i.ibb.co/VpL1pqqB/velora-scalp.jpg",
  },
  {
    serviceName: "Deep Repair Hair Mask",
    category: "Hair Treatment",
    description:
      "An intensive protein and moisture mask for dry, colored or heat-damaged hair. Sealed with gentle heat for deeper absorption and finished with a smooth blow-dry.",
    price: 45,
    duration: 40,
    image: "https://i.ibb.co/NnTMXnzP/velora-repair.jpg",
  },
  {
    serviceName: "Hydra Glow Facial",
    category: "Facial & Skincare",
    description:
      "Cleanse, exfoliate and hydrate in one calming treatment. A cooling mask and hyaluronic serum leave your skin plump, fresh and glowing, with zero downtime.",
    price: 65,
    duration: 60,
    image: "https://i.ibb.co/j988XBHz/velora-hydra.jpg",
  },
  {
    serviceName: "24K Gold Radiance Facial",
    category: "Facial & Skincare",
    description:
      "Our most luxurious facial: a brightening peel, gold-infused mask and lymphatic massage that lift and illuminate dull skin. A favourite before weddings and big events.",
    price: 110,
    duration: 75,
    image: "https://i.ibb.co/5x98szL1/velora-gold.jpg",
  },
  {
    serviceName: "Deep Cleansing Facial",
    category: "Facial & Skincare",
    description:
      "Steam, gentle extractions and a clay mask that clear congested pores and calm breakouts. Recommended once a month for oily and combination skin.",
    price: 55,
    duration: 60,
    image: "https://i.ibb.co/nsHjxxQL/velora-cleanse.jpg",
  },
  {
    serviceName: "Vitamin C Brightening Mask",
    category: "Facial & Skincare",
    description:
      "A quick, vitamin-packed express facial that evens tone and revives tired skin. Perfect lunchtime pick-me-up with an instant fresh-faced glow.",
    price: 35,
    duration: 30,
    image: "https://i.ibb.co/6JwZzfc8/velora-mask.jpg",
    status: "inactive",
  },
  {
    serviceName: "Party Glam Makeup",
    category: "Makeup",
    description:
      "Full-coverage, camera-ready makeup with soft contour, defined eyes and lashes included. Designed to last through dinner, dancing and every photo.",
    price: 70,
    duration: 60,
    image: "https://i.ibb.co/ZRMHLBY2/velora-party.jpg",
  },
  {
    serviceName: "Bridal Makeup & Styling",
    category: "Makeup",
    description:
      "Your complete wedding-day look: a skin-prep facial, long-wear HD makeup, lashes, dupatta setting and hair styling. Includes a touch-up kit for the evening.",
    price: 250,
    duration: 180,
    image: "https://i.ibb.co/QFh25jLf/velora-bridal.jpg",
  },
  {
    serviceName: "Natural Day Makeup",
    category: "Makeup",
    description:
      "A light, fresh 'no-makeup' makeup look that evens skin and brightens eyes. Great for interviews, graduations and daytime events.",
    price: 40,
    duration: 40,
    image: "https://i.ibb.co/kgB9fhCy/velora-natural.jpg",
  },
  {
    serviceName: "Gel Manicure",
    category: "Manicure & Pedicure",
    description:
      "Nail shaping, cuticle care and a chip-free gel polish in your choice of over 80 shades. Lasts up to three weeks with a high-gloss finish.",
    price: 30,
    duration: 45,
    image: "https://i.ibb.co/DHVc1BG9/velora-gel.jpg",
  },
  {
    serviceName: "Luxury Spa Pedicure",
    category: "Manicure & Pedicure",
    description:
      "A warm soak, callus care, sugar scrub and calf massage, finished with polish of your choice. Your feet will feel brand new.",
    price: 40,
    duration: 60,
    image: "https://i.ibb.co/5hB6H5Rr/velora-pedi.jpg",
  },
  {
    serviceName: "Custom Nail Art",
    category: "Manicure & Pedicure",
    description:
      "Chrome, French tips, gems or hand-painted designs: bring your inspiration and our nail artists will bring it to life on a gel base.",
    price: 50,
    duration: 75,
    image: "https://i.ibb.co/84GPMr5R/velora-nailart.jpg",
  },
  {
    serviceName: "Hot Stone Massage",
    category: "Spa & Massage",
    description:
      "Smooth heated basalt stones melt away deep muscle tension while long flowing strokes calm the mind. A full-body treatment for total relaxation.",
    price: 95,
    duration: 90,
    image: "https://i.ibb.co/RGbqH9y1/velora-aroma.jpg",
  },
  {
    serviceName: "Aromatherapy Massage",
    category: "Spa & Massage",
    description:
      "A soothing full-body massage with your choice of lavender, eucalyptus or citrus essential oils, tailored to relax, uplift or restore.",
    price: 80,
    duration: 60,
    image: "https://i.ibb.co/RGbqH9y1/velora-aroma.jpg",
  },
  {
    serviceName: "Back, Neck & Shoulder Relief",
    category: "Spa & Massage",
    description:
      "A focused massage for desk-bound shoulders and stiff necks. Firm pressure works out knots so you leave lighter and more relaxed.",
    price: 45,
    duration: 30,
    image: "https://i.ibb.co/9H2TdfH8/velora-swedish.jpg",
  },
  {
    serviceName: "Indian Head Massage",
    category: "Spa & Massage",
    description:
      "A traditional head, scalp and face massage with warm oil that relieves stress headaches and improves sleep. Can be added to any hair service.",
    price: 35,
    duration: 30,
    image: "https://i.ibb.co/YBP0hwXM/velora-head.jpg",
    status: "inactive",
  },
];
