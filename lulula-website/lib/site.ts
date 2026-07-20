// Single source of truth for all site content and links.
// Editing copy, prices, or contact details? Do it here — the components read from this.

export const site = {
  name: "Nails at Lulula",
  shortName: "Lulula",
  tagline: "Gel, BIAB & acrylic nails in Geldermalsen",
  owner: "Lauren",
  location: "Geldermalsen, Netherlands",
  email: "info@lulula.nl",
  phoneDisplay: "+31 6 3441 5020",
  // wa.me needs the number in international format, digits only.
  whatsapp: "https://wa.me/31634415020",
  booking: "https://nails-at-lulula.salonized.com/widget_bookings/new",
  instagram: "https://instagram.com/nailsatlulula",
  facebook: "https://www.facebook.com/profile.php?id=100091532023434",
  url: "https://lulula.nl",
  // Location — clickable link + keyless embed (output=embed needs no API key).
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=Geldermalsen%2C+Netherlands",
  mapEmbed:
    "https://www.google.com/maps?q=Geldermalsen%2C+Netherlands&z=12&output=embed",
} as const;

export const nav = [
  { label: "About", href: "#about-me" },
  { label: "Prices", href: "#pricelist" },
  { label: "Gallery", href: "#gallery" },
  { label: "Aftercare", href: "#aftercare" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Contact", href: "#contact-me" },
] as const;

export const aboutText =
  "I'm originally from South Africa and have been living in the Netherlands since October 2020. I started nails as a hobby but quickly realized it was growing into a full-blown passion. I completed a nail course at Utrecht Nail Academy in March 2023 and completed my all-round training in Gel, BIAB and Acrylic. I am extremely passionate about what I do and take the utmost pride in every set of nails I get to work on. I love to focus on what each individual client wants and making them feel confident about their nail choice. When I'm not working, I'm running around and being a mom to 3 boys with the help of my wonderful husband.";

export type PriceItem = {
  name: string;
  price: string;
  note?: string;
  desc?: string;
};
export type PriceGroup = { title: string; items: PriceItem[] };

export const priceGroups: PriceGroup[] = [
  {
    title: "Hand Treatments",
    items: [
      { name: "BIAB with Gel Polish", price: "€38" },
      { name: "BIAB with Gel Polish including removal", price: "€43" },
      { name: "BIAB with French Paint / Nail art", price: "€46" },
      { name: "Manicure (no after product)", price: "€33" },
      { name: "Removal", price: "€23" },
      {
        name: "Hand & arm de-ageing treatment",
        price: "€30",
        note: "30 min",
        desc: "A treatment with highly effective fruit and vegetable enzymes. The treatment will improve the visible signs of ageing and will leave the skin well exfoliated, brighter, and hydrated.",
      },
    ],
  },
  {
    title: "Treatment with Extensions (Gel or Acryl-Gel)",
    items: [
      { name: "Natural Overlay", price: "€65" },
      { name: "Gel Polish", price: "€70" },
    ],
  },
  {
    title: "Treatment without Extensions (Gel or Acryl-Gel)",
    items: [
      { name: "Natural Overlay", price: "€55" },
      { name: "Gel Polish", price: "€60" },
    ],
  },
  {
    title: "Foot Treatments",
    items: [
      {
        name: "Basic Foot Treatment",
        price: "€38",
        note: "1 h",
        desc: "Cuticle and nail care with gel polish.",
      },
      {
        name: "Luxury Foot Treatment",
        price: "€55",
        note: "1 h",
        desc: "This treatment begins with a crystal soak infused with essential minerals and bronze mica to detoxify and energize the skin, followed by a gentle exfoliation with a crushed sugar formula infused with grape seed oil and sunflower oil, leaving the skin feeling velvety soft, then a relaxing massage and moisture treatment using a grape seed oil-rich cream to deeply hydrate and nourish the skin. Completed with a cuticle oil containing argan and jojoba oil to hydrate and nourish the cuticles, leaving the hands and feet feeling rejuvenated and revitalized.",
      },
      {
        name: "Deluxe Foot Treatment",
        price: "€65",
        note: "1.5 h",
        desc: "Phyto Heel Exfoliation is a highly effective deep exfoliation that removes dead skin cell build-up. Glycolic acid and pumpkin enzymes break down the protein bonds that hold dead skin cells together, so these can easily be buffed away. The skin will feel smooth and hydrated.",
      },
      {
        name: "Hand & Foot Paraffin Dip",
        price: "€20",
        note: "30 min",
        desc: "A heat therapy treatment using warm, melted paraffin wax to relieve pain, improve circulation, and moisturize the skin.",
      },
    ],
  },
];

export type AftercareTip = { title: string; body: string; icon: string };

export const aftercare: AftercareTip[] = [
  {
    icon: "droplet",
    title: "Wear gloves for washing up",
    body: "This will keep your nails shiny and avoid drying the nail bed.",
  },
  {
    icon: "sparkles",
    title: "Use cuticle oil daily",
    body: "This can increase the circulation around your nails, stimulating nail growth.",
  },
  {
    icon: "flame",
    title: "Avoid intense heat",
    body: "It can cause the product to lift up and even peel off altogether.",
  },
  {
    icon: "ban",
    title: "Never pick or peel",
    body: "This removes the top layer of your nail causing damage and weakening of the nails, so they are more susceptible to cracking and breaking.",
  },
  {
    icon: "calendar",
    title: "Book your next appointment",
    body: "To prevent nail breakage, cracks, and lifting it's important to have your nails refilled regularly to have them looking perfect again.",
  },
  {
    icon: "gem",
    title: "Jewels not tools",
    body: "Using your nails to open cans, peel stickers, or perform other tasks can cause damage and lead to premature chipping or lifting of the product.",
  },
];

export const testimonials = [
  {
    name: "Elaine Husted",
    quote:
      "Very professional. Nails always look amazing. I highly recommend Lauren @ Lulula nails. You won't be disappointed.",
  },
  {
    name: "Lijanta Fourie",
    quote: "Amazing atmosphere, and gorgeous nails. Highly recommended.",
  },
  {
    name: "Gabriella Robertson",
    quote:
      "Love going to Lauren for my nails, such precise work and my nails always look gorgeous when I leave. Highly recommend nails @ Lulula!",
  },
  {
    name: "Evadne Edwards",
    quote: "Very professional, her work is amazing!",
  },
  {
    name: "Jessica Skroce",
    quote:
      "I would definitely recommend Lauren as your nail technician, she is so talented, professional and provides a wonderful experience. I always leave feeling emotionally, physically and spiritually rested, restored and renewed. Plus, my nails look AMAZING! It's my haven away from home. Lauren is trusting, reliable, accommodating and works with me when and if I have a change in schedule. If you are looking for 5 star treatment then get on her waiting list. It's worth it!",
  },
  {
    name: "Lisette van Leersum-Bijvank",
    quote:
      "Goede vakvrouw, erg proffesioneel! Maakt prachtige nagels en is ook nog erg lief en gezellig 👌🏻",
  },
];

export const openingHours = [
  { day: "Monday", hours: "10:00 – 20:00" },
  { day: "Tuesday", hours: "09:00 – 13:30" },
  { day: "Wednesday", hours: "10:00 – 13:30" },
  { day: "Thursday", hours: "09:00 – 13:00" },
  { day: "Friday", hours: "09:00 – 13:30" },
  { day: "Saturday", hours: "Closed" },
  { day: "Sunday", hours: "Closed" },
];
