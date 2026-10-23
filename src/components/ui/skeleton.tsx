import { cn } from "@/lib/utils";

/**
 * A blank waiting to be filled.
 *
 * On this surface a skeleton is a page that has been laid down but not written
 * on yet, so it is paper-coloured with the ruling showing through rather than a
 * grey pill: the shape that arrives is the shape that was already there. The
 * sweep is slow and low-contrast on purpose — a fast shimmer reads as a loading
 * spinner wearing a rectangle.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2px] bg-rule/45",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[wash_1.8s_ease-in-out_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-paper/70 after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
