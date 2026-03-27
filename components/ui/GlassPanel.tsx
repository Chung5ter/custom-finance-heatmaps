"use client";
import { forwardRef } from "react";
import { clsx } from "clsx";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  radius?: "sm" | "md" | "lg" | "xl";
}

const paddingMap = {
  none: "",
  sm: "p-2",
  md: "p-4",
  lg: "p-6",
};
const radiusMap = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ hover = false, padding = "md", radius = "lg", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "glass",
          hover && "glass-hover cursor-pointer",
          paddingMap[padding],
          radiusMap[radius],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
GlassPanel.displayName = "GlassPanel";
