"use client"

import { Maximize, Minimize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMapStore } from "@/context/mapStore"

interface FullscreenToggleProps {
  className?: string
}

export function FullscreenToggle({ className = "" }: FullscreenToggleProps) {
  const { isFullscreen, toggleFullscreen } = useMapStore()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className={`bg-white/95 backdrop-blur-sm border border-border shadow-lg hover:bg-accent hover:text-accent-foreground transition-all duration-200 ${className}`}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
