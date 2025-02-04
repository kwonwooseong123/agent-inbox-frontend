"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  tickCount?: number; // 추가: 눈금 개수 조절 가능
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, orientation = "horizontal", tickCount = 5, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      "relative flex touch-none select-none",
      orientation === "horizontal"
        ? "w-full items-center"
        : "h-full flex-col items-center",
      className
    )}
    {...props}
  >
    {/* 슬라이더 트랙 (전체 배경) */}
    <SliderPrimitive.Track
      className={cn(
        "relative grow overflow-hidden rounded-full bg-gray-200",
        orientation === "horizontal" ? "h-1.5 w-full" : "h-full w-1.5"
      )}
    >
      {/* 선택된 범위 (프로그레스 바) */}
      <SliderPrimitive.Range
        className="absolute bg-gray-500"
        style={
          orientation === "horizontal" ? { height: "100%" } : { width: "100%" }
        }
      />
    </SliderPrimitive.Track>

    {/* 눈금 표시 (동적으로 개수 조절 가능) */}
    {[...Array(tickCount)].map((_, index) => (
      <div
        key={index}
        className="absolute h-2 w-2 rounded-full bg-gray-500"
        style={
          orientation === "horizontal"
            ? {
                left: `${(index / (tickCount - 1)) * 100}%`,
                transform: "translateX(-50%)",
              }
            : {
                bottom: `${(index / (tickCount - 1)) * 100}%`,
                transform: "translateY(50%)",
              }
        }
      />
    ))}

    {/* 슬라이더 핸들 (사용자 입력) */}
    <SliderPrimitive.Thumb asChild>
      <motion.div
        className="block h-4 w-4 rounded-full border border-gray-500 bg-background shadow"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300 }}
      />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
));

Slider.displayName = "Slider";

export { Slider };
