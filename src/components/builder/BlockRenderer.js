"use client";
import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────
// PUBLIC BLOCK RENDERER — turns page_json into actual page
// ─────────────────────────────────────────────────────────
function Countdown({ targetDate, label, accent }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
      });
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || !timeLeft) return null;

  return (
    <div className="text-center py-5 px-4 rounded-xl" style={{ background: `${accent}11` }}>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center justify-center gap-4">
        {[["Days", timeLeft.days], ["Hours", timeLeft.hours], ["Mins", timeLeft.mins]].map(([l, v]) => (
          <div key={l}>
            <p className="text-2xl font-bold" style={{ color: accent }}>{v}</p>
            <p className="text-xs text-gray-400">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlockRenderer({ blocks, accent }) {
  return (
    <div>
      {(blocks || []).map(block => {
        const p = block.props;
        switch (block.type) {
          case "hero":
            return (
              <div key={block.id} className="relative" style={{ minHeight: 200, background: p.image_url ? `url(${p.image_url}) center/cover` : accent }}>
                <div className="flex flex-col justify-end p-6" style={{ minHeight: 200, background: p.overlay ? "linear-gradient(transparent, rgba(0,0,0,0.65))" : "none" }}>
                  <h1 className="text-white font-bold text-2xl">{p.title}</h1>
                  {p.subtitle && <p className="text-white opacity-90 text-sm mt-1">{p.subtitle}</p>}
                </div>
              </div>
            );

          case "text":
            return (
              <div key={block.id} className="px-4 py-4" style={{ textAlign: p.align }}>
                {p.heading && <h2 className="font-bold text-lg mb-2 text-gray-900">{p.heading}</h2>}
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{p.body}</p>
              </div>
            );

          case "countdown":
            return (
              <div key={block.id} className="px-4 py-3">
                <Countdown targetDate={p.target_date} label={p.label} accent={accent} />
              </div>
            );

          case "speakers":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
                <div className="grid grid-cols-3 gap-3">
                  {p.items.map((s, i) => (
                    <div key={i} className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-1.5" style={s.photo_url ? { backgroundImage: `url(${s.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
                      <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "faq":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
                <div className="space-y-2">
                  {p.items.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
                </div>
              </div>
            );

          case "gallery":
            return (
              <div key={block.id} className="px-4 py-4 grid grid-cols-3 gap-1.5">
                {p.images.map((img, i) => (
                  <img key={i} src={img} className="aspect-square object-cover rounded-lg" />
                ))}
              </div>
            );

          case "video": {
            if (!p.url) return null;
            let embedUrl = p.url;
            const ytMatch = p.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            return (
              <div key={block.id} className="px-4 py-4">
                <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
                </div>
                {p.caption && <p className="text-xs text-gray-400 mt-2 text-center">{p.caption}</p>}
              </div>
            );
          }

          case "map":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.embed_url ? (
                  <iframe src={p.embed_url} className="w-full rounded-xl" style={{ height: 200, border: 0 }} loading="lazy" />
                ) : (
                  <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">📍 {p.address}</div>
                )}
              </div>
            );

          case "divider":
            return p.style === "space"
              ? <div key={block.id} className="h-8" />
              : <hr key={block.id} className="mx-4 border-gray-200" />;

          case "html":
            // Sanitized — strip script tags for safety
            const safeHtml = (p.code || "").replace(/<script[\s\S]*?<\/script>/gi, "");
            return <div key={block.id} className="px-4 py-2" dangerouslySetInnerHTML={{ __html: safeHtml }} />;

          default:
            return null;
        }
      })}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <span className="text-gray-400 text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-3 pb-2.5 text-sm text-gray-500">{a}</div>}
    </div>
  );
}