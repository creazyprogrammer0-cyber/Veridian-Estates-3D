import React, { useState, useEffect } from 'react';
import { FloorPlanRoom, VisualPresetKey } from '../types/property';

interface ArchitecturalVisualProps {
  preset: VisualPresetKey;
  imageUrl?: string;
  alt: string;
  className?: string;
  caption?: string;
  isDemonstration?: boolean;
  enableZoom?: boolean;
  onExpandClick?: () => void;
}

/**
 * Contemporary Luxury Architectural Visual Renderer.
 * Renders high-resolution verified photographs when supplied (`referrerPolicy="no-referrer"`),
 * or bespoke daylight architectural plates engineered around #FFFFFF, #17191D, #2855E8, and #E9EDF4.
 */
export const ArchitecturalVisual: React.FC<ArchitecturalVisualProps> = ({
  preset,
  imageUrl,
  alt,
  className = 'w-full h-full',
  caption,
  enableZoom = true,
  onExpandClick,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imageUrl && !imgFailed) {
    return (
      <figure
        className={`group relative overflow-hidden bg-[#17191D] ${onExpandClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onExpandClick}
      >
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`w-full h-full object-cover ${enableZoom ? 'arch-image-zoom' : ''}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17191D]/75 via-[#17191D]/10 to-transparent" />
        {caption && (
          <figcaption className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between gap-3 text-xs text-white font-mono">
            <span className="truncate">{caption}</span>
            {onExpandClick && (
              <span className="text-[11px] text-[#E9EDF4] shrink-0">INSPECT PLATE →</span>
            )}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure
      className={`group relative overflow-hidden select-none bg-[#17191D] ${
        onExpandClick ? 'cursor-pointer' : ''
      } ${className}`}
      role="img"
      aria-label={alt}
      onClick={onExpandClick}
    >
      <div className={`w-full h-full ${enableZoom ? 'arch-image-zoom' : ''}`}>
        {preset === 'hero_pavilion' && (
          <svg
            viewBox="0 0 1200 750"
            className="w-full h-full object-cover"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="daylightSky" x1="0" y1="0" x2="0.15" y2="1">
                <stop offset="0%" stopColor="#1B2A4A" />
                <stop offset="45%" stopColor="#3B5998" />
                <stop offset="82%" stopColor="#A9BCD9" />
                <stop offset="100%" stopColor="#E9EDF4" />
              </linearGradient>
              <linearGradient id="archStoneWhite" x1="0" y1="0" x2="1" y2="0.3">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#F2F5FA" />
                <stop offset="100%" stopColor="#DCE3EE" />
              </linearGradient>
              <linearGradient id="archStoneShadow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#B8C2D4" />
                <stop offset="100%" stopColor="#7E899D" />
              </linearGradient>
              <linearGradient id="daylightInterior" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#E9EDF4" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#BAC5D8" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="reflectingPool" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#17191D" />
                <stop offset="45%" stopColor="#1D2B4F" />
                <stop offset="100%" stopColor="#11141A" />
              </linearGradient>
            </defs>

            {/* Crisp Alpine Daylight Sky */}
            <rect width="1200" height="750" fill="url(#daylightSky)" />

            {/* Subtle Architectural Survey Grid */}
            <g stroke="#FFFFFF" strokeWidth="0.6" opacity="0.16">
              <line x1="0" y1="130" x2="1200" y2="130" />
              <line x1="0" y1="535" x2="1200" y2="535" />
              <line x1="160" y1="0" x2="160" y2="750" />
              <line x1="1040" y1="0" x2="1040" y2="750" />
            </g>

            {/* Distant Alpine Horizon Ridge */}
            <polygon
              points="0,470 190,340 430,410 720,285 980,360 1200,310 1200,535 0,535"
              fill="#273349"
              opacity="0.65"
            />
            <polygon
              points="260,535 580,330 890,415 1200,355 1200,535"
              fill="#1C2434"
              opacity="0.78"
            />

            {/* Architectural Trees Silhouette */}
            <g fill="#17191D" opacity="0.85">
              <ellipse cx="95" cy="400" rx="26" ry="135" />
              <ellipse cx="132" cy="425" rx="20" ry="110" />
              <ellipse cx="1075" cy="380" rx="28" ry="155" />
              <ellipse cx="1115" cy="415" rx="22" ry="125" />
              <ellipse cx="1038" cy="430" rx="18" ry="105" />
            </g>

            {/* Monolithic Plinth & Cantilevered Terraces */}
            <polygon points="120,535 1060,535 1090,502 150,502" fill="#9AA5B8" />
            <rect x="150" y="485" width="910" height="22" fill="url(#archStoneWhite)" />

            {/* Ground Floor Recessed Structural Glazing */}
            <rect x="195" y="345" width="810" height="140" fill="#17191D" />
            {/* Daylight-Filled Ground Salon & Gallery */}
            <rect x="220" y="358" width="440" height="127" fill="url(#daylightInterior)" />
            <rect x="700" y="358" width="275" height="127" fill="url(#daylightInterior)" opacity="0.82" />

            {/* Interior Architectural Columns & Minimalist Furniture Silhouettes */}
            <rect x="330" y="358" width="14" height="127" fill="#17191D" opacity="0.85" />
            <rect x="490" y="358" width="14" height="127" fill="#17191D" opacity="0.85" />
            <rect x="275" y="448" width="190" height="26" fill="#232730" opacity="0.85" />
            <rect x="760" y="438" width="140" height="34" fill="#232730" opacity="0.8" />

            {/* Anodized Charcoal Curtain Wall Mullions Level 1 */}
            <g stroke="#17191D" strokeWidth="4">
              {[220, 308, 396, 484, 572, 660, 700, 790, 880, 975].map((x) => (
                <line key={x} x1={x} y1="352" x2={x} y2="485" />
              ))}
            </g>

            {/* Dramatic Cantilevered Upper Floor Slab */}
            <polygon points="115,345 1045,345 1065,320 135,320" fill="url(#archStoneWhite)" />
            <rect x="115" y="341" width="930" height="5" fill="#2855E8" opacity="0.85" />
            <polygon points="1045,345 1065,320 1065,332 1045,352" fill="url(#archStoneShadow)" />

            {/* Upper Level Penthouse Volume (Offset Asymmetrical Massing) */}
            <rect x="235" y="190" width="690" height="130" fill="#17191D" />
            <rect x="260" y="204" width="430" height="116" fill="url(#daylightInterior)" />
            <rect x="720" y="204" width="180" height="116" fill="url(#daylightInterior)" opacity="0.75" />

            {/* Solid Architectural White Stone Shear Wall Piers */}
            <rect x="685" y="190" width="42" height="130" fill="url(#archStoneWhite)" />
            <rect x="195" y="345" width="32" height="140" fill="url(#archStoneWhite)" />
            <rect x="660" y="345" width="40" height="140" fill="url(#archStoneWhite)" />

            {/* Upper Steel Mullions & Low-Iron Glass Balustrade */}
            <g stroke="#17191D" strokeWidth="3.5">
              {[260, 345, 430, 515, 600, 725, 810, 900].map((x) => (
                <line key={x} x1={x} y1="200" x2={x} y2="320" />
              ))}
            </g>
            {/* Cantilevered Glass Terrace Balustrade */}
            <rect x="135" y="286" width="910" height="34" fill="#E9EDF4" opacity="0.24" />
            <line x1="135" y1="286" x2="1045" y2="286" stroke="#FFFFFF" strokeWidth="2" />

            {/* Floating Roof Overhang Slab */}
            <polygon points="180,190 975,190 995,168 200,168" fill="url(#archStoneWhite)" />
            <rect x="180" y="186" width="795" height="4" fill="#17191D" />

            {/* Foreground Reflecting Pool & Architectural Parterre */}
            <rect x="0" y="535" width="1200" height="215" fill="#17191D" />
            <polygon points="90,540 1110,540 1190,750 10,750" fill="url(#reflectingPool)" />

            {/* Daylight Reflection Shimmer on Water */}
            <g opacity="0.32">
              <rect x="225" y="550" width="430" height="165" fill="url(#daylightInterior)" />
              <rect x="705" y="550" width="265" height="140" fill="url(#daylightInterior)" opacity="0.65" />
            </g>
            {/* Water Ripples */}
            <g stroke="#17191D" strokeWidth="3">
              {[565, 585, 610, 640, 675, 715].map((y) => (
                <line key={y} x1="100" y1={y} x2="1100" y2={y} />
              ))}
            </g>
            {/* Stepping Stone Promenade */}
            <g fill="#E9EDF4">
              <polygon points="440,680 560,680 575,702 425,702" />
              <polygon points="465,712 585,712 600,736 450,736" />
            </g>
          </svg>
        )}

        {preset === 'solaris_coastal' && (
          <svg
            viewBox="0 0 1000 750"
            className="w-full h-full object-cover"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="coastalSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B325F" />
                <stop offset="55%" stopColor="#587BB8" />
                <stop offset="100%" stopColor="#E9EDF4" />
              </linearGradient>
              <linearGradient id="cobaltSea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E3F85" />
                <stop offset="50%" stopColor="#162952" />
                <stop offset="100%" stopColor="#17191D" />
              </linearGradient>
              <linearGradient id="whiteSlab" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#DCE3EF" />
              </linearGradient>
            </defs>
            <rect width="1000" height="750" fill="url(#coastalSky)" />
            {/* Daylight Sun Disc */}
            <circle cx="780" cy="320" r="75" fill="#FFFFFF" opacity="0.38" />
            {/* Mediterranean Sea Horizon */}
            <rect x="0" y="430" width="1000" height="320" fill="url(#cobaltSea)" />
            {/* Sea Light Path */}
            <g stroke="#E9EDF4" strokeWidth="1.5" opacity="0.35">
              {[445, 462, 485, 515, 550, 595].map((y, idx) => (
                <line key={y} x1={710 - idx * 14} y1={y} x2={850 + idx * 14} y2={y} />
              ))}
            </g>

            {/* Coastal Granite Promontory */}
            <polygon points="0,580 0,210 340,260 650,415 810,565 0,580" fill="#2C323D" />
            <polygon points="0,580 280,360 650,415 810,565" fill="#17191D" />

            {/* Stepped Cantilevered White Concrete Coastal Villas */}
            <g>
              <polygon points="55,145 430,145 445,164 55,164" fill="url(#whiteSlab)" />
              <rect x="75" y="164" width="335" height="78" fill="#17191D" />
              <rect x="95" y="172" width="225" height="70" fill="#E9EDF4" opacity="0.88" />
              <rect x="335" y="164" width="55" height="78" fill="url(#whiteSlab)" />
              <polygon points="45,242 465,242 475,260 45,260" fill="url(#whiteSlab)" />
            </g>

            {/* Mid Cliff Horizon Residence */}
            <g>
              <rect x="145" y="260" width="420" height="86" fill="#17191D" />
              <rect x="170" y="270" width="280" height="76" fill="#E9EDF4" opacity="0.9" />
              <rect x="465" y="260" width="75" height="86" fill="url(#whiteSlab)" />
              {/* Architectural Brise-Soleil Louvers */}
              <g stroke="#2C323D" strokeWidth="3">
                {[360, 372, 384, 396, 408, 420, 432, 444].map((x) => (
                  <line key={x} x1={x} y1="264" x2={x} y2="346" />
                ))}
              </g>
              <polygon points="120,346 610,346 625,368 120,368" fill="url(#whiteSlab)" />
              {/* Infinity Plunge Pool Cantilever */}
              <polygon points="480,346 665,346 680,362 490,362" fill="#2855E8" />
            </g>

            {/* Lower Sea-Level Terrace */}
            <g>
              <rect x="245" y="368" width="410" height="82" fill="#17191D" />
              <rect x="275" y="378" width="265" height="72" fill="#E9EDF4" opacity="0.82" />
              <polygon points="220,450 710,450 730,472 220,472" fill="url(#whiteSlab)" />
            </g>
          </svg>
        )}

        {preset === 'kensington_courtyard' && (
          <svg
            viewBox="0 0 1000 750"
            className="w-full h-full object-cover"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="londonDaySky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#202838" />
                <stop offset="100%" stopColor="#65738C" />
              </linearGradient>
              <linearGradient id="portlandWhite" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#DCE2EC" />
              </linearGradient>
              <linearGradient id="charcoalMasonry" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2B303B" />
                <stop offset="100%" stopColor="#17191D" />
              </linearGradient>
            </defs>
            <rect width="1000" height="750" fill="url(#londonDaySky)" />

            {/* Contemporary Proportioned Charcoal Masonry & White Portland Stone Facade */}
            <rect x="70" y="75" width="860" height="475" fill="url(#charcoalMasonry)" />
            {/* White Stone Cornices & String Courses */}
            <rect x="55" y="60" width="890" height="24" fill="url(#portlandWhite)" />
            <rect x="65" y="225" width="870" height="16" fill="url(#portlandWhite)" />
            <rect x="65" y="390" width="870" height="18" fill="url(#portlandWhite)" />

            {/* Deep-Set Fluted Portland Stone Window Bays */}
            {[125, 275, 425, 575, 725].map((x, idx) => (
              <g key={x}>
                {/* Upper Story */}
                <rect x={x - 8} y="105" width="116" height="120" fill="url(#portlandWhite)" />
                <rect x={x} y="113" width="100" height="112" fill="#17191D" />
                <rect
                  x={x + 6}
                  y="119"
                  width="88"
                  height="100"
                  fill="#E9EDF4"
                  opacity={idx % 2 === 0 ? '0.82' : '0.48'}
                />
                <line x1={x + 50} y1="113" x2={x + 50} y2="225" stroke="#17191D" strokeWidth="3" />

                {/* Piano Nobile Story */}
                <rect x={x - 8} y="258" width="116" height="132" fill="url(#portlandWhite)" />
                <rect x={x} y="266" width="100" height="124" fill="#17191D" />
                <rect
                  x={x + 6}
                  y="272"
                  width="88"
                  height="112"
                  fill="#E9EDF4"
                  opacity={idx === 1 || idx === 3 ? '0.9' : '0.55'}
                />
                <line x1={x + 50} y1="266" x2={x + 50} y2="390" stroke="#17191D" strokeWidth="3" />

                {/* Ground Cloister Colonnade */}
                <rect x={x - 14} y="408" width="24" height="142" fill="url(#portlandWhite)" />
                <rect x={x + 14} y="418" width="88" height="132" fill="#17191D" />
                <rect x={x + 22} y="426" width="72" height="124" fill="#E9EDF4" opacity="0.68" />
              </g>
            ))}
            <rect x="865" y="408" width="26" height="142" fill="url(#portlandWhite)" />

            {/* Courtyard & Reflection Basin */}
            <rect x="0" y="550" width="1000" height="200" fill="#17191D" />
            <polygon points="110,565 890,565 950,750 50,750" fill="#1D2B4F" />
            {/* Architectural Courtyard Borders */}
            <rect x="125" y="542" width="240" height="22" fill="#E9EDF4" />
            <rect x="635" y="542" width="240" height="22" fill="#E9EDF4" />
          </svg>
        )}

        {(preset === 'penthouse_interior' ||
          preset === 'kitchen_atelier' ||
          preset === 'building_elevation') && (
          <svg
            viewBox="0 0 1000 750"
            className="w-full h-full object-cover"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="ceilWhite" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#E9EDF4" />
              </linearGradient>
              <linearGradient id="stoneFloorCool" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DCE2EC" />
                <stop offset="100%" stopColor="#F2F5FA" />
              </linearGradient>
              <linearGradient id="daylightVista" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2855E8" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#8AA4D6" />
                <stop offset="100%" stopColor="#32415C" />
              </linearGradient>
            </defs>

            {/* 1-Point Contemporary Luxury Interior Perspective */}
            {/* Ceiling Plane */}
            <polygon points="0,0 1000,0 810,135 190,135" fill="url(#ceilWhite)" />
            {/* Recessed Architectural Cove Lighting Slot */}
            <line x1="210" y1="115" x2="790" y2="115" stroke="#FFFFFF" strokeWidth="5" />

            {/* Floor Plane (Honed Architectural Stone Slabs) */}
            <polygon points="0,750 1000,750 810,515 190,515" fill="url(#stoneFloorCool)" />
            {/* Perspective Stone Joint Lines */}
            <g stroke="#B8C2D4" strokeWidth="1">
              <line x1="500" y1="515" x2="500" y2="750" />
              <line x1="345" y1="515" x2="180" y2="750" />
              <line x1="655" y1="515" x2="820" y2="750" />
              <line x1="120" y1="585" x2="880" y2="585" />
              <line x1="55" y1="665" x2="945" y2="665" />
            </g>

            {/* Left Architectural Gallery Wall */}
            <polygon points="0,0 190,135 190,515 0,750" fill="#E9EDF4" />
            {/* Right Brushed Charcoal Architectural Panel Wall */}
            <polygon points="1000,0 810,135 810,515 1000,750" fill="#262A34" />
            <g stroke="#17191D" strokeWidth="2" opacity="0.7">
              {[835, 860, 885, 910, 935, 960].map((x, i) => (
                <line key={x} x1={x} y1={115 - i * 16} x2={x} y2={535 + i * 28} />
              ))}
            </g>

            {/* Panoramic Floor-to-Ceiling Curtain Wall */}
            <rect
              x="190"
              y="135"
              width="620"
              height="380"
              fill="url(#daylightVista)"
              stroke="#17191D"
              strokeWidth="6"
            />
            {/* Distant Horizon Silhouette Outside Window */}
            <polygon
              points="194,395 360,295 540,350 720,265 806,320 806,512 194,512"
              fill="#1E2738"
              opacity="0.72"
            />
            {/* Curtain Wall Mullions */}
            <line x1="396" y1="135" x2="396" y2="515" stroke="#17191D" strokeWidth="5" />
            <line x1="603" y1="135" x2="603" y2="515" stroke="#17191D" strokeWidth="5" />

            {/* Diagonal Daylight Cast on Stone Floor */}
            <polygon
              points="195,515 780,515 920,730 290,730"
              fill="#FFFFFF"
              opacity="0.4"
            />

            {/* Foreground Monolithic Furniture Composition */}
            {preset === 'kitchen_atelier' ? (
              <g>
                {/* Monolithic Architectural Waterfall Kitchen Island */}
                <polygon points="260,465 740,465 775,495 225,495" fill="#FFFFFF" />
                <rect x="225" y="495" width="550" height="125" fill="#17191D" />
                <rect x="255" y="510" width="490" height="95" fill="#2A303C" />
              </g>
            ) : (
              <g>
                {/* Cool Grey Architectural Area Rug */}
                <polygon points="180,565 820,565 910,715 90,715" fill="#E9EDF4" />
                {/* Low-Profile Pure White Architectural Sectional */}
                <rect
                  x="220"
                  y="485"
                  width="390"
                  height="95"
                  fill="#FFFFFF"
                  stroke="#B8C2D4"
                  strokeWidth="1.5"
                />
                <rect
                  x="235"
                  y="445"
                  width="360"
                  height="44"
                  fill="#F2F5FA"
                  stroke="#B8C2D4"
                  strokeWidth="1"
                />
                {/* Monolithic Near-Black & Cool Grey Plinth Table */}
                <rect x="440" y="595" width="290" height="48" fill="#17191D" />
                <rect x="465" y="643" width="240" height="22" fill="#9AA5B8" />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Subtle Bottom Scrim & Architectural Caption Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#17191D]/75 via-[#17191D]/15 to-transparent" />

      {caption && (
        <figcaption className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between gap-3 text-xs text-white font-mono">
          <span className="truncate">{caption}</span>
          {onExpandClick && (
            <span className="text-[11px] text-[#E9EDF4] shrink-0">FULLSCREEN PLATE →</span>
          )}
        </figcaption>
      )}
    </figure>
  );
};

export interface GalleryItem {
  id: string;
  preset: VisualPresetKey;
  imageUrl?: string;
  title: string;
  caption: string;
  aspectLabel: string;
}

interface ArchitecturalGalleryProps {
  items: GalleryItem[];
  sectionLabel?: string;
  heading?: string;
}

/**
 * Multi-Ratio Editorial Gallery with Fullscreen Lightbox Inspection.
 * Uses Pure White (#FFFFFF), Near Black (#17191D), Cobalt Blue (#2855E8), and Cool Grey (#E9EDF4).
 */
export const ArchitecturalGallery: React.FC<ArchitecturalGalleryProps> = ({
  items,
  sectionLabel = 'ARCHITECTURAL DOCUMENTATION',
  heading = 'Spatial & Material Perspectives',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIndex(null);
      if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % items.length));
      }
      if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) =>
          prev === null ? 0 : (prev - 1 + items.length) % items.length
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;

  const primary = items[0];
  const secondary = items.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E9EDF4] pb-4">
        <div>
          <p className="text-xs font-mono text-[#2855E8]">{sectionLabel}</p>
          <h3 className="text-2xl lg:text-3xl font-semibold text-[#17191D] mt-1">{heading}</h3>
        </div>
        <button
          type="button"
          onClick={() => setActiveIndex(0)}
          className="px-4 py-2 text-xs font-medium text-[#17191D] bg-white border border-[#17191D] hover:bg-[#17191D] hover:text-white arch-transition whitespace-nowrap shrink-0"
        >
          Open Fullscreen Lightbox ({items.length} Plates)
        </button>
      </div>

      {/* Asymmetric Multi-Ratio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 min-h-[360px] lg:min-h-[460px] border border-[#E9EDF4]">
          <ArchitecturalVisual
            preset={primary.preset}
            imageUrl={primary.imageUrl}
            alt={primary.title}
            caption={`Fig. 01 · ${primary.title} — ${primary.caption}`}
            className="w-full h-full"
            onExpandClick={() => setActiveIndex(0)}
          />
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          {secondary.map((item, idx) => (
            <div
              key={item.id}
              className="flex-1 min-h-[215px] border border-[#E9EDF4] relative"
            >
              <ArchitecturalVisual
                preset={item.preset}
                imageUrl={item.imageUrl}
                alt={item.title}
                caption={`Fig. 0${idx + 2} · ${item.title} — ${item.caption}`}
                className="w-full h-full"
                onExpandClick={() => setActiveIndex(idx + 1)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {activeIndex !== null && items[activeIndex] && (
        <div
          className="fixed inset-0 z-50 bg-[#17191D]/95 flex flex-col justify-between p-6 lg:p-10 text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen Architectural Plate Viewer"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div className="text-xs font-mono text-[#E9EDF4] tabular-nums">
              PLATE 0{activeIndex + 1} OF 0{items.length} · {items[activeIndex].aspectLabel}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((activeIndex - 1 + items.length) % items.length)
                }
                className="px-3.5 py-1.5 text-xs font-mono border border-white/20 hover:bg-white/10 whitespace-nowrap shrink-0"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((activeIndex + 1) % items.length)}
                className="px-3.5 py-1.5 text-xs font-mono border border-white/20 hover:bg-white/10 whitespace-nowrap shrink-0"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                className="px-4 py-1.5 text-xs font-medium bg-white text-[#17191D] hover:bg-[#E9EDF4] whitespace-nowrap shrink-0"
              >
                Close Lightbox (Esc)
              </button>
            </div>
          </div>

          <div className="my-6 flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full max-w-5xl h-full max-h-[68vh] border border-white/20">
              <ArchitecturalVisual
                preset={items[activeIndex].preset}
                imageUrl={items[activeIndex].imageUrl}
                alt={items[activeIndex].title}
                enableZoom={false}
                className="w-full h-full"
              />
            </div>
          </div>

          <div className="max-w-5xl mx-auto w-full pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="text-2xl font-display text-white">{items[activeIndex].title}</h4>
              <p className="text-xs text-[#9BA3B4] mt-1">{items[activeIndex].caption}</p>
            </div>
            <div className="flex gap-2">
              {items.map((it, idx) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`px-3 py-1 text-xs font-mono border whitespace-nowrap shrink-0 ${
                    idx === activeIndex
                      ? 'bg-[#2855E8] text-white border-[#2855E8]'
                      : 'bg-transparent text-[#E9EDF4] border-white/20 hover:text-white'
                  }`}
                >
                  0{idx + 1}. {it.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface InteractiveFloorPlanProps {
  rooms: FloorPlanRoom[];
  selectedRoomId: string;
  onSelectRoom: (room: FloorPlanRoom) => void;
  unitCode: string;
  areaSqm: number;
  areaConvention: string;
  synchronizedWith3D?: boolean;
  variant?: 'light' | 'dark';
  onLaunch3DRoom?: (room: FloorPlanRoom) => void;
}

/**
 * Interactive 2D Architectural CAD Floor Plan Viewer.
 * Strictly uses Pure White (#FFFFFF), Near Black (#17191D), Cobalt Blue (#2855E8), and Cool Grey (#E9EDF4).
 */
export const InteractiveFloorPlan: React.FC<InteractiveFloorPlanProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  unitCode,
  areaSqm,
  areaConvention,
  synchronizedWith3D = false,
  variant = 'light',
  onLaunch3DRoom,
}) => {
  const activeRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];
  const isDark = variant === 'dark';

  return (
    <div
      className={`border p-6 lg:p-8 ${
        isDark
          ? 'bg-[#17191D] border-white/15 text-white'
          : 'bg-white border-[#E9EDF4] text-[#17191D]'
      }`}
    >
      <div
        className={`flex flex-wrap items-end justify-between gap-4 pb-5 mb-6 border-b ${
          isDark ? 'border-white/15' : 'border-[#E9EDF4]'
        }`}
      >
        <div>
          <p
            className={`text-xs font-mono ${
              isDark ? 'text-[#E9EDF4]' : 'text-[#2855E8]'
            }`}
          >
            ARCHITECTURAL CAD FLOOR PLATE · RESIDENCE {unitCode}
          </p>
          <h4 className="text-2xl font-semibold mt-1">
            Interactive Spatial Plan ({areaSqm} sq.m · {areaConvention})
          </h4>
        </div>
        <div
          className={`text-xs font-mono ${
            isDark ? 'text-[#9BA3B4]' : 'text-[#525866]'
          }`}
        >
          {synchronizedWith3D
            ? '3D VIEWPORT SYNCHRONIZED · CLICK ANY ROOM TO TELEPORT'
            : 'SELECT ANY SPATIAL ZONE TO INSPECT DIMENSIONS'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Precision CAD Floor Plan SVG */}
        <div
          className={`lg:col-span-7 border p-5 flex items-center justify-center relative ${
            isDark
              ? 'bg-[#111317] border-white/15'
              : 'bg-[#E9EDF4]/55 border-[#E9EDF4]'
          }`}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-auto max-h-[410px]"
            role="group"
            aria-label={`Interactive floor plan for ${unitCode}`}
          >
            <defs>
              <pattern
                id={`cadGrid-${variant}`}
                width="5"
                height="5"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 5 0 L 0 0 0 5"
                  fill="none"
                  stroke={isDark ? '#252932' : '#D5DCE8'}
                  strokeWidth="0.22"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill={`url(#cadGrid-${variant})`} />

            {/* Top Architectural Dimension Ruler */}
            <g
              stroke={isDark ? '#687082' : '#687082'}
              strokeWidth="0.3"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="2.2"
              fill={isDark ? '#9BA3B4' : '#525866'}
            >
              <line x1="6" y1="4.5" x2="94" y2="4.5" />
              <line x1="6" y1="3.2" x2="6" y2="5.8" />
              <line x1="50" y1="3.5" x2="50" y2="5.5" />
              <line x1="94" y1="3.2" x2="94" y2="5.8" />
              <text x="50" y="3.3" textAnchor="middle" stroke="none">
                STRUCTURAL SPAN 11.40M · SCALE 1:100
              </text>
            </g>

            {/* Outer Load-Bearing Structural Perimeter Wall */}
            <rect
              x="6"
              y="8"
              width="88"
              height="82"
              fill={isDark ? '#17191D' : '#FFFFFF'}
              stroke={isDark ? '#FFFFFF' : '#17191D'}
              strokeWidth="1.3"
            />

            {/* Panoramic Curtain Wall Glazing Line (Bottom South-West Elevation) */}
            <line
              x1="8"
              y1="66"
              x2="92"
              y2="66"
              stroke="#2855E8"
              strokeWidth="0.9"
              strokeDasharray="2,1"
            />

            {/* Room Zones */}
            {rooms.map((room, idx) => {
              const isSelected = room.id === activeRoom?.id;
              const fillSelected = '#2855E8';
              const fillDefault = isDark ? '#20242C' : '#E9EDF4';
              const strokeColor = isSelected
                ? '#2855E8'
                : isDark
                  ? '#4E5565'
                  : '#9AA5B8';

              return (
                <g
                  key={room.id}
                  onClick={() => onSelectRoom(room)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${room.name}, ${room.areaSqm} square meters`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectRoom(room);
                    }
                  }}
                >
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.width}
                    height={room.height}
                    fill={isSelected ? fillSelected : fillDefault}
                    fillOpacity={isSelected ? (isDark ? 0.42 : 0.14) : 0.85}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '1.15' : '0.45'}
                  />

                  {/* Zone Index Callout */}
                  <text
                    x={room.x + 2.2}
                    y={room.y + 4.2}
                    fontSize="2.3"
                    fontFamily="IBM Plex Mono, monospace"
                    fill={
                      isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#2855E8'
                        : isDark
                          ? '#9BA3B4'
                          : '#525866'
                    }
                  >
                    0{idx + 1}
                  </text>

                  {/* Room Title */}
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + room.height / 2 - 1.5}
                    textAnchor="middle"
                    fontSize="3.0"
                    fontWeight="600"
                    fill={
                      isSelected
                        ? isDark
                          ? '#FFFFFF'
                          : '#2855E8'
                        : isDark
                          ? '#E9EDF4'
                          : '#17191D'
                    }
                    fontFamily="Manrope, sans-serif"
                  >
                    {room.name}
                  </text>

                  {/* Metric Dimensions */}
                  <text
                    x={room.x + room.width / 2}
                    y={room.y + room.height / 2 + 2.8}
                    textAnchor="middle"
                    fontSize="2.35"
                    fill={isDark ? '#9BA3B4' : '#525866'}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {room.areaSqm} m² · {room.dimensionsLabel}
                  </text>

                  {/* Active Camera Target Reticle */}
                  {isSelected && (
                    <circle
                      cx={room.x + room.width / 2}
                      cy={room.y + room.height - 3.2}
                      r="1.3"
                      fill="#2855E8"
                    />
                  )}
                </g>
              );
            })}

            {/* Compass & Metric Scale Bar */}
            <g
              transform="translate(89, 96)"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="2.4"
              fill={isDark ? '#FFFFFF' : '#17191D'}
            >
              <text x="0" y="0" textAnchor="middle">
                N ↑
              </text>
            </g>
            <g
              transform="translate(8, 96)"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="2.2"
              fill={isDark ? '#9BA3B4' : '#525866'}
            >
              <text x="0" y="0">
                0m ─── 5m ─── 10m
              </text>
            </g>
          </svg>
        </div>

        {/* Right: Active Room Dossier & Quick Zone Switcher */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          {activeRoom && (
            <div
              className={`border p-5 space-y-4 ${
                isDark
                  ? 'bg-[#111317] border-white/15'
                  : 'bg-[#E9EDF4]/45 border-[#E9EDF4]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-mono ${
                    isDark ? 'text-[#E9EDF4]' : 'text-[#2855E8]'
                  }`}
                >
                  ACTIVE SPATIAL ZONE
                </span>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    isDark ? 'text-[#9BA3B4]' : 'text-[#525866]'
                  }`}
                >
                  {activeRoom.areaSqm} sq.m · {activeRoom.dimensionsLabel}
                </span>
              </div>

              <h5 className="text-2xl font-semibold">{activeRoom.name}</h5>

              <p
                className={`text-sm leading-relaxed ${
                  isDark ? 'text-[#E9EDF4]' : 'text-[#525866]'
                }`}
              >
                {activeRoom.finishSummary}
              </p>

              <div
                className={`pt-4 border-t ${
                  isDark ? 'border-white/15' : 'border-[#E9EDF4]'
                }`}
              >
                <div
                  className={`text-xs font-mono mb-2.5 ${
                    isDark ? 'text-[#9BA3B4]' : 'text-[#525866]'
                  }`}
                >
                  VERIFIED ZONE SPECIFICATIONS
                </div>
                <ul className="space-y-1.5 text-xs">
                  {activeRoom.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <span className="text-[#2855E8]">—</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {onLaunch3DRoom && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => onLaunch3DRoom(activeRoom)}
                    className="w-full px-4 py-2.5 text-xs font-semibold bg-[#2855E8] text-white hover:bg-[#1E44C4] arch-transition whitespace-nowrap"
                  >
                    Step Inside {activeRoom.name} in 3D →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Room Quick-Selector Matrix */}
          <div>
            <div
              className={`text-xs font-mono mb-2.5 ${
                isDark ? 'text-[#9BA3B4]' : 'text-[#525866]'
              }`}
            >
              SPATIAL ZONE DIRECTORY ({rooms.length} ROOMS)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rooms.map((room, index) => {
                const active = room.id === activeRoom?.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onSelectRoom(room)}
                    className={`px-3.5 py-2 text-left text-xs font-medium arch-transition flex items-center justify-between gap-2 border ${
                      active
                        ? 'bg-[#2855E8] text-white border-[#2855E8]'
                        : isDark
                          ? 'bg-[#111317] text-[#E9EDF4] border-white/15 hover:border-white/40'
                          : 'bg-white text-[#17191D] border-[#E9EDF4] hover:bg-[#E9EDF4]'
                    }`}
                  >
                    <span className="truncate">
                      0{index + 1}. {room.name}
                    </span>
                    <span className="font-mono text-[11px] opacity-80 shrink-0 tabular-nums">
                      {room.areaSqm}m²
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
