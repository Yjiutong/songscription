import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Check, Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons in a book are printed, pressed or glued — never floating chips.
 *
 * Each one carries a hairline of its own colour darkened, a thin highlight
 * along its top edge where the light lands, and the same offset-plus-blur
 * shadow every piece of paper on this page casts. Pressing moves it a pixel
 * into the board and takes the light away. No block offsets, no glow, no ring.
 */
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[5px] border font-label font-semibold transition-[background-color,box-shadow,transform,border-color] duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kraft-deep active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // 鎏金键：整页上唯一又暖又饱和的东西，留给这一页存在的那个动作。
        default:
          "border-kraft-deep/45 bg-kraft text-graphite shadow-lift [box-shadow:inset_0_1px_0_rgba(255,251,238,0.45),var(--lift-1)] hover:bg-[#e2be5f] active:[box-shadow:inset_0_1px_3px_rgba(42,24,14,0.28)]",
        paper:
          "border-rule bg-paper text-graphite [box-shadow:inset_0_1px_0_rgba(255,255,255,0.7),var(--lift-1)] hover:bg-paper-warm active:[box-shadow:inset_0_1px_3px_rgba(42,24,14,0.2)]",
        board:
          "border-board-deep bg-board text-paper [box-shadow:inset_0_1px_0_rgba(233,208,138,0.18),var(--lift-1)] hover:bg-board-soft active:[box-shadow:inset_0_1px_3px_rgba(0,0,0,0.35)]",
        quiet:
          "border-transparent bg-transparent text-graphite-soft hover:bg-rule/45 hover:text-graphite active:translate-y-0",
        "quiet-on-board":
          "border-transparent bg-transparent text-rule hover:bg-paper/10 hover:text-paper active:translate-y-0",
        link: "border-transparent bg-transparent text-kraft-deep underline decoration-kraft/70 underline-offset-[5px] hover:decoration-kraft-deep active:translate-y-0",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px] [&_svg]:size-[15px]",
        default: "h-10 px-4 text-[14px] [&_svg]:size-[17px]",
        lg: "h-12 px-5 text-[15px] [&_svg]:size-[18px]",
        // The two PLAY sizes. Hearing the piece is the only way a beginner can
        // judge it, so the control is sized as the primary act of the page.
        key: "h-[52px] px-5 text-[15px] [&_svg]:size-[19px]",
        transport: "h-[68px] px-7 text-[17px] [&_svg]:size-[22px]",
        icon: "h-10 w-10 [&_svg]:size-[17px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Working. Shows a spinner in place of the leading icon and blocks input. */
  busy?: boolean;
  /** Just finished. Shows a tick for a moment so the click had an answer. */
  done?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, busy, done, children, ...props }, ref) => {
    // Slot forwards to a single child element, so a rendered state icon would
    // break it. `asChild` is for links, which have no work to report anyway.
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={busy || undefined}
        disabled={busy || props.disabled}
        {...props}
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : done ? (
          <Check aria-hidden />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
