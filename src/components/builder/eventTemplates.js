// Ready-to-use event page templates: real-looking content, photos and form
// questions, so a merchant only changes names, dates and images. Text uses
// the event's own title / date / place from the Details tab when they're set.
//
// Photos are bundled in /public/event-templates (from Unsplash, free to use).

const IMG = (name, origin = "") => `${origin}/event-templates/${name}.jpg`;

let seq = 0;
const id = () => `b_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const NAME = { id: "name", type: "text", label: "Full name", required: true };
const PHONE = { id: "phone", type: "phone", label: "WhatsApp number", required: true };
const EMAIL = { id: "email", type: "email", label: "Email", required: false };
const field = (label, type = "text", extra = {}) => ({ id: `f_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, label, type, required: false, ...extra });

const formBlock = (heading, subheading) => ({ id: "registration_form", type: "registration_form", props: { heading, subheading } });

export const EVENT_TEMPLATES = [
  {
    key: "conference",
    label: "Conference / Expo",
    desc: "Multi-speaker event with schedule, speakers and venue",
    cover: "conference",
    accent: "#4f46e5",
    fields: [NAME, PHONE, EMAIL, field("Company / Organisation"), field("Designation")],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("conference", c.origin), tag: "Annual Conference", title: c.title || "Future of Business Summit 2026", subtitle: "A full day of talks, workshops and networking with industry leaders", overlay: true } },
      { id: id(), type: "countdown", props: { target_date: c.date || "", label: "The summit starts in" } },
      formBlock("Reserve your free pass", "Seats are limited. Your pass comes on WhatsApp."),
      { id: id(), type: "text", props: { heading: "About the event", body: "Join founders, business owners and experts for a day of practical talks on growth, technology and marketing.\n\nMeet 500+ professionals, discover new tools, and leave with ideas you can use the very next day.", align: "left" } },
      { id: id(), type: "agenda", props: { heading: "Schedule", items: [
        { time: "09:30 AM", title: "Registration & welcome coffee", desc: "" },
        { time: "10:00 AM", title: "Keynote: Growing a business in 2026", desc: "" },
        { time: "11:30 AM", title: "Panel: Digital tools that actually work", desc: "" },
        { time: "01:00 PM", title: "Lunch & networking", desc: "" },
        { time: "02:30 PM", title: "Workshops (choose one)", desc: "Marketing · Finance · Hiring" },
        { time: "05:00 PM", title: "Closing note & prize draw", desc: "" },
      ] } },
      { id: id(), type: "speakers", props: { heading: "Speakers", items: [
        { name: "Dr. Priya Raman", role: "Chief Guest", photo_url: "" },
        { name: "Arjun Mehta", role: "Founder, GrowthLab", photo_url: "" },
        { name: "Kavya Iyer", role: "Marketing Head", photo_url: "" },
      ] } },
      { id: id(), type: "gallery", props: { heading: "Last year's highlights", images: [IMG("venue", c.origin), IMG("hall", c.origin), IMG("audience", c.origin)] } },
      { id: id(), type: "map", props: { heading: "Venue", address: c.location || "Chennai Trade Centre, Nandambakkam, Chennai", embed_url: "" } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Is the event free?", a: "Yes, entry is free for registered guests. Please carry your WhatsApp pass." },
        { q: "Is parking available?", a: "Yes, free parking is available at the venue." },
        { q: "Will lunch be provided?", a: "Yes, lunch and refreshments are included for all registered guests." },
        { q: "Can I bring a colleague?", a: "Each person needs to register separately - just share this page with them." },
      ] } },
    ],
  },
  {
    key: "workshop",
    label: "Workshop / Class",
    desc: "Hands-on session with what you'll learn and who it's for",
    cover: "workshop",
    accent: "#0d9488",
    fields: [NAME, PHONE, EMAIL, field("Experience level", "dropdown", { options: ["Beginner", "Intermediate", "Advanced"] })],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("workshop", c.origin), tag: "Hands-on workshop", title: c.title || "Digital Marketing Masterclass", subtitle: "Learn by doing - bring your laptop", overlay: true } },
      formBlock("Book your seat", "Only 30 seats per batch."),
      { id: id(), type: "text", props: { heading: "What you'll learn", body: "✓ Plan a month of content in one hour\n✓ Run your first ad campaign on a small budget\n✓ Read the numbers that matter\n✓ Templates and checklists to take home", align: "left" } },
      { id: id(), type: "text", props: { heading: "Who is it for?", body: "Small business owners, freelancers and students who want practical skills - no prior experience needed.", align: "left" } },
      { id: id(), type: "speakers", props: { heading: "Your trainer", items: [{ name: "Rahul Krishnan", role: "Trainer, 10+ years", photo_url: "" }] } },
      { id: id(), type: "gallery", props: { heading: "", images: [IMG("workshop-2", c.origin), IMG("workshop", c.origin), IMG("meetup", c.origin)] } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Do I need to bring anything?", a: "Bring a laptop and a notebook. We'll share all material on WhatsApp." },
        { q: "Will I get a certificate?", a: "Yes, everyone who attends the full session gets a certificate." },
        { q: "Can I get a refund?", a: "Cancel up to 48 hours before for a full refund." },
      ] } },
    ],
  },
  {
    key: "webinar",
    label: "Webinar / Online",
    desc: "Online session - join link comes on WhatsApp",
    cover: "webinar",
    accent: "#2563eb",
    fields: [NAME, PHONE, EMAIL, field("Your question for the speaker", "textarea")],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("webinar", c.origin), tag: "Free webinar", title: c.title || "How to Get More Customers on WhatsApp", subtitle: "Live online - join from anywhere", overlay: true } },
      { id: id(), type: "countdown", props: { target_date: c.date || "", label: "Goes live in" } },
      formBlock("Save my seat", "The join link comes on WhatsApp before we start."),
      { id: id(), type: "agenda", props: { heading: "Agenda", items: [
        { time: "0:00", title: "Welcome & introductions", desc: "" },
        { time: "0:10", title: "Main session", desc: "" },
        { time: "0:45", title: "Live Q&A", desc: "" },
      ] } },
      { id: id(), type: "speakers", props: { heading: "Host", items: [{ name: "Ananya Sharma", role: "Host", photo_url: "" }] } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Where do I join?", a: "We'll send the join link to your WhatsApp 30 minutes before we start." },
        { q: "Will there be a recording?", a: "Yes, everyone who registers gets the recording." },
      ] } },
    ],
  },
  {
    key: "launch",
    label: "Product Launch",
    desc: "Build excitement with a countdown and teaser video",
    cover: "launch",
    accent: "#db2777",
    fields: [NAME, PHONE, EMAIL],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("launch", c.origin), tag: "Launching soon", title: c.title || "Something new is coming", subtitle: "Be the first to see it - and get launch-day offers", overlay: true } },
      { id: id(), type: "countdown", props: { target_date: c.date || "", label: "Launching in" } },
      formBlock("Get early access", "Registered guests get an exclusive launch-day offer on WhatsApp."),
      { id: id(), type: "video", props: { url: "", caption: "Watch the teaser" } },
      { id: id(), type: "text", props: { heading: "Why you'll love it", body: "Tell your story here - what problem it solves, what's new, and why it's worth coming to the launch.", align: "center" } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "What do I get for registering?", a: "An exclusive launch-day offer, sent to your WhatsApp." },
        { q: "Is there an entry fee?", a: "No, the launch event is free." },
      ] } },
    ],
  },
  {
    key: "property",
    label: "Property Open House",
    desc: "Site visit for a project - highlights, location, visit slot",
    cover: "property",
    accent: "#b45309",
    fields: [NAME, PHONE, field("Preferred visit time", "dropdown", { options: ["Morning (10 AM - 1 PM)", "Afternoon (1 PM - 4 PM)", "Evening (4 PM - 7 PM)"] }), field("Budget", "dropdown", { options: ["Under ₹50 L", "₹50 L - ₹1 Cr", "₹1 Cr - ₹2 Cr", "Above ₹2 Cr"] })],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("property", c.origin), tag: "Open house", title: c.title || "Site Visit - Green Meadows Villas", subtitle: "Walk through the show villa and meet our team", overlay: true } },
      formBlock("Book your site visit", "Pick a time - we'll confirm on WhatsApp."),
      { id: id(), type: "text", props: { heading: "Project highlights", body: "✓ 3 & 4 BHK villas with private gardens\n✓ Clubhouse, pool and kids' play area\n✓ 24×7 security and power backup\n✓ Approved for home loans by leading banks", align: "left" } },
      { id: id(), type: "gallery", props: { heading: "Gallery", images: [IMG("property", c.origin), IMG("property-2", c.origin), IMG("venue", c.origin)] } },
      { id: id(), type: "map", props: { heading: "Location", address: c.location || "Green Meadows, OMR, Chennai", embed_url: "" } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Is the site visit free?", a: "Yes. We can also arrange pick-up on request." },
        { q: "Are bank loans available?", a: "Yes, the project is approved by leading banks. Our team can help with the process." },
        { q: "Can I bring my family?", a: "Of course - you're welcome to bring family members." },
      ] } },
    ],
  },
  {
    key: "health",
    label: "Health Camp",
    desc: "Free check-up camp with services and timings",
    cover: "health",
    accent: "#059669",
    fields: [NAME, PHONE, field("Age", "number"), field("Check-up needed", "dropdown", { options: ["General check-up", "Diabetes", "Blood pressure", "Eye check-up", "Dental"] })],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("health", c.origin), tag: "Free health camp", title: c.title || "Free Health Check-up Camp", subtitle: "Doctors' consultation and tests at no cost", overlay: true } },
      formBlock("Register for a free check-up", "Your token number comes on WhatsApp."),
      { id: id(), type: "text", props: { heading: "Services available", body: "✓ Blood sugar & BP check\n✓ Eye and dental screening\n✓ Doctor consultation\n✓ Free medicines for eligible patients", align: "left" } },
      { id: id(), type: "agenda", props: { heading: "Timings", items: [
        { time: "08:00 AM", title: "Registration & token", desc: "Fasting tests first" },
        { time: "09:00 AM", title: "Check-ups begin", desc: "" },
        { time: "01:00 PM", title: "Camp closes", desc: "" },
      ] } },
      { id: id(), type: "map", props: { heading: "Venue", address: c.location || "Community Hall, Anna Nagar, Chennai", embed_url: "" } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Is it really free?", a: "Yes, all check-ups and the consultation are free." },
        { q: "Should I come fasting?", a: "For the blood sugar test, please come fasting (no food for 8 hours)." },
        { q: "What should I bring?", a: "Any old prescriptions or reports, and your WhatsApp token." },
      ] } },
    ],
  },
  {
    key: "meetup",
    label: "Community Meetup",
    desc: "Casual networking evening",
    cover: "meetup",
    accent: "#7c3aed",
    fields: [NAME, PHONE, EMAIL, field("What do you do?")],
    blocks: (c) => [
      { id: id(), type: "hero", props: { image_url: IMG("meetup", c.origin), tag: "Meetup", title: c.title || "Founders & Builders Meetup", subtitle: "An evening of conversations, ideas and new friends", overlay: true } },
      formBlock("RSVP", "Free entry - just let us know you're coming."),
      { id: id(), type: "agenda", props: { heading: "Evening plan", items: [
        { time: "06:00 PM", title: "Arrivals & snacks", desc: "" },
        { time: "06:30 PM", title: "Lightning talks (5 min each)", desc: "" },
        { time: "07:30 PM", title: "Open networking", desc: "" },
      ] } },
      { id: id(), type: "map", props: { heading: "Where", address: c.location || "The Hub Café, Indiranagar, Bengaluru", embed_url: "" } },
      { id: id(), type: "faq", props: { heading: "Questions", items: [
        { q: "Who can come?", a: "Anyone building or planning a business - all experience levels welcome." },
        { q: "Can I give a lightning talk?", a: "Yes! Mention it when you register and we'll reach out." },
      ] } },
    ],
  },
];

/** The blocks and form fields for a template, filled from the event details. */
export function buildTemplate(key, details = {}, origin = "") {
  const t = EVENT_TEMPLATES.find(x => x.key === key);
  if (!t) return null;
  const c = {
    title: (details.title || "").trim(),
    date: details.event_date || "",
    location: (details.location || "").trim(),
    origin,
  };
  return { blocks: t.blocks(c), fields: t.fields.map(f => ({ ...f })), accent: t.accent, cover: IMG(t.cover, origin) };
}
