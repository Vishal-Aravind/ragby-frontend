"use client";

import { useState } from "react";
import { withAlpha } from "../_lib/shopApi";

/**
 * Brand header: cover image (3:1) or an accent block, a round logo that
 * overlaps the cover's bottom-left edge, the store name and the branch line.
 * The sticky search bar lives in the page, below this.
 */
export default function ShopHeader({ storeName, coverUrl, logoUrl, accent, branchName, showBranch, canChangeBranch, onChangeBranch, statusLine }) {
  const [coverOk, setCoverOk] = useState(true);
  const [logoOk, setLogoOk] = useState(true);
  const hasCover = !!coverUrl && coverOk;
  const hasLogo = !!logoUrl && logoOk;

  return (
    <header className="bg-white">
      {hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="w-full aspect-[3/1] max-h-56 object-cover bg-gray-100"
          referrerPolicy="no-referrer"
          onError={() => setCoverOk(false)}
        />
      ) : (
        <div
          className="w-full h-20"
          style={{ background: `linear-gradient(135deg, ${accent}, ${withAlpha(accent, "b3", accent)})` }}
          aria-hidden="true"
        />
      )}
      <div className="px-4 pb-3">
        <div className="flex items-end gap-3">
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={storeName ? `${storeName} logo` : "Logo"}
              className="w-16 h-16 rounded-full object-cover bg-white ring-4 ring-white shadow-md -mt-8 shrink-0 relative"
              referrerPolicy="no-referrer"
              onError={() => setLogoOk(false)}
            />
          )}
          <div className={`min-w-0 flex-1 ${hasLogo ? "" : "pt-3"}`}>
            <h1 className="font-bold text-gray-900 text-xl leading-tight truncate">{storeName || "Menu"}</h1>
          </div>
        </div>
        {(showBranch || statusLine) && (
          <div className="mt-1.5">
            {showBranch && branchName && (
              <p className="text-sm text-gray-600 truncate">
                🏪 {branchName}
                {canChangeBranch && (
                  <button onClick={onChangeBranch} className="ml-1 font-semibold" style={{ color: accent }}>
                    · Change
                  </button>
                )}
              </p>
            )}
            {statusLine && <p className="text-xs text-gray-500 mt-0.5">{statusLine}</p>}
          </div>
        )}
      </div>
    </header>
  );
}
