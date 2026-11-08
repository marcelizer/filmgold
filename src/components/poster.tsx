import Image from "next/image";
import { cn } from "@/lib/cn";
import { contentTitle } from "@/lib/content";
import { formatYear, initials, mediaImage } from "@/lib/format";
import { tr, type Locale } from "@/lib/locale";

type PosterMovie = {
  id: number;
  titleDe: string;
  titleEn?: string | null;
  titleOriginal?: string | null;
  year: number | null;
  posterPath: string | null;
  posterLocal?: string | null;
};

function hueFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Poster({
  movie,
  className,
  imageSize = "w500",
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw",
  eager = false,
  locale = "de",
}: {
  movie: PosterMovie;
  className?: string;
  imageSize?: "w342" | "w500" | "w780" | "original";
  sizes?: string;
  eager?: boolean;
  locale?: Locale;
}) {
  const src = mediaImage(movie.posterLocal, movie.posterPath, imageSize);
  const title = contentTitle(movie, locale);
  const hue = hueFor(title);

  return (
    <div
      className={cn(
        "relative aspect-2/3 overflow-hidden rounded-xl border border-white/10 bg-surface-2",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={tr(locale, `Filmplakat von ${title}`, `Movie poster for ${title}`)}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-hidden p-4"
          style={{
            background: `radial-gradient(120% 85% at 15% 0%, hsl(${hue} 32% 25%) 0%, #0b0c0f 62%), linear-gradient(160deg, hsl(${hue} 18% 16%), #090a0c)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,0.035) 14px 15px)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.22em] text-white/45">
              Filmgold
            </span>
            <span className="text-[10px] tabular-nums text-white/40">
              {formatYear(movie.year)}
            </span>
          </div>
          <div className="relative">
            <p className="display text-5xl leading-none text-white/85">
              {initials(title)}
            </p>
            <p className="mt-3 line-clamp-3 text-[12px] font-medium leading-snug text-white/65">
              {title}
            </p>
            <div className="mt-3 h-px w-8 bg-gold/60" />
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
        <div className="poster-shine absolute inset-0" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-70" />
    </div>
  );
}
