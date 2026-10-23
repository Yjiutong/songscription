"use client";

import type { ComponentPropsWithoutRef } from "react";
import React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * A control inside crop marks.
 *
 * The four corner chevrons are registration marks — the marks a printer leaves
 * on a sheet to say where the page is — so on a surface made of paper they are
 * the one ornament that is actually from this world. They pull outward on
 * hover, as if the frame were being opened up around the control.
 *
 * Pulled from 21st.dev and repigmented: the original ships black-on-white with
 * a dark-mode pair, which is not a palette this project has.
 */
type ButtonVariant = "clay" | "paper" | "board" | "outline";

type BaseProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  size?: number | string;
  offset?: number;
  hoverOffset?: number;
};

type ButtonProps = BaseProps &
  ComponentPropsWithoutRef<typeof motion.button> & {
    as?: "button";
    href?: never;
  };

type AnchorProps = BaseProps &
  Omit<ComponentPropsWithoutRef<typeof motion.a>, "href"> & {
    as: "link";
    href: string;
  };

type FrameButtonProps = ButtonProps | AnchorProps;

export function FrameButton({
  children,
  className,
  variant = "clay",
  size = 14,
  offset = 6,
  hoverOffset = 4,
  ...props
}: FrameButtonProps) {
  const skin = cn(
    "group relative inline-flex select-none items-center justify-center overflow-visible",
    "cursor-pointer whitespace-nowrap rounded-[5px] border no-underline",
    "font-label font-semibold uppercase tracking-[0.16em]",
    "transition-[background-color,box-shadow,transform,border-color] duration-150",
    "[box-shadow:inset_0_1px_0_rgba(255,253,244,0.5),inset_0_-1px_0_rgba(24,30,18,0.16),var(--lift-1)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[6px]",
    "focus-visible:outline-kraft-deep active:translate-y-px",
    "active:[box-shadow:inset_0_1px_3px_rgba(42,24,14,0.26)]",
    "disabled:pointer-events-none disabled:opacity-45",

    variant === "clay" &&
      "kraft border-kraft-deep/50 text-graphite shadow-lift hover:brightness-[1.05]",
    variant === "paper" && "border-rule bg-paper text-graphite shadow-lift hover:bg-paper-warm",
    variant === "board" && "border-board-deep bg-board text-paper shadow-lift hover:bg-board-soft",
    variant === "outline" && "border-rule/60 bg-transparent text-paper hover:bg-paper/10",

    className,
  );

  const content = (
    <>
      {children}
      <FrameMarkers size={size} offset={offset} hoverOffset={hoverOffset} />
    </>
  );

  if (props.as === "link") {
    const { as: _as, href, ...anchorProps } = props;
    return (
      <motion.a href={href} className={skin} {...anchorProps}>
        {content}
      </motion.a>
    );
  }

  const { as: _as, ...buttonProps } = props;
  return (
    <motion.button className={skin} {...buttonProps}>
      {content}
    </motion.button>
  );
}

type IconProps = React.SVGProps<SVGSVGElement>;

function corner(path: string) {
  return function Corner({ className, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        {...props}
      >
        <path d={path} />
      </svg>
    );
  };
}

export const ChevronUpLeft = corner("M8 16v-8h8");
export const ChevronUpRight = corner("M16 16v-8h-8");
export const ChevronDownRight = corner("M16 8v8h-8");
export const ChevronDownLeft = corner("M8 8v8h8");

interface FrameMarkersProps {
  className?: string;
  size?: number | string;
  offset?: number;
  hoverOffset?: number;
}

export function FrameMarkers({
  className,
  size = 15,
  offset = 6,
  hoverOffset = 4,
}: FrameMarkersProps) {
  const sized = typeof size === "string" && size.includes("-");
  const box = sized ? {} : { width: size, height: size };

  // Tailwind v3 has no `transform-[…]` utility, so the transform is written as
  // an arbitrary property. The snippet's v4 syntax compiles to nothing here.
  const base = cn(
    "pointer-events-none absolute text-graphite/45 transition-transform duration-300 ease-out",
    "group-hover:text-graphite group-hover:[transform:translate(var(--mx),var(--my))]",
    sized ? size : "",
    className,
  );

  const out = `${hoverOffset}px`;
  const back = `-${hoverOffset}px`;
  const edge = `-${offset}px`;
  const corners = [
    { Mark: ChevronUpLeft, style: { top: edge, left: edge, "--mx": back, "--my": back } },
    { Mark: ChevronUpRight, style: { top: edge, right: edge, "--mx": out, "--my": back } },
    { Mark: ChevronDownRight, style: { bottom: edge, right: edge, "--mx": out, "--my": out } },
    { Mark: ChevronDownLeft, style: { bottom: edge, left: edge, "--mx": back, "--my": out } },
  ];

  return (
    <>
      {corners.map(({ Mark, style }, i) => (
        <Mark
          key={i}
          className={base}
          style={{ ...box, ...style } as unknown as React.CSSProperties}
        />
      ))}
    </>
  );
}

export default FrameButton;
