"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMapStore } from "@/context/mapStore"
import { useState, useEffect } from "react"
import { PatwarKhanaIcon } from "@/components/icons/PatwarKhanaIcon"

export function Sidebar() {
  const { layers, toggleLayerWithZoom, isCollapsed, toggleSidebar, getActiveLayersCount } = useMapStore()

  console.log("📋 Sidebar: Rendered. Layers:", layers.map(l => ({ id: l.id, active: l.active })))

  // Function to get the icon component based on the icon name
  const getIconComponent = (iconName?: string) => {
    switch (iconName) {
      case "Building2":
        return Building2
      case "PatwarKhana":
        return PatwarKhanaIcon
      default:
        return null
    }
  }

function logLayerStates() {
  console.log("Sidebar: Current Layer States:", layers.map(l => ({ id: l.id, active: l.active })))
}

useEffect(() => {
  logLayerStates()
}, [layers])

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    administrative: true,
    facilities: true,
  })

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  const layerGroups = [
    {
      id: "administrative",
      title: "Administrative Boundaries",
      layers: layers.filter((layer) =>
        ["Pakistan", "khyber-pakhtunkhwa", "divisions", "districts", "tehsils"].includes(layer.id),
      ),
    },
    {
      id: "facilities",
      title: "Facilities & Points of Interest",
      layers: layers.filter((layer) =>
        ["patwarkhana"].includes(layer.id),
      ),
    },
  ]

  return (
    <TooltipProvider>
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`fixed left-0 bg-card/95 backdrop-blur-sm border-r border-border shadow-xl transition-all duration-300 z-40 ${
          isCollapsed ? "w-16" : "w-80"
        }`}
        style={{
          top: "88px",
          height: "calc(100vh - 88px)",
        }}
      >
        {/* Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="absolute -right-4 top-4 z-10 bg-card border border-border shadow-md hover:bg-accent"
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}</TooltipContent>
        </Tooltip>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 h-full overflow-y-auto"
            >
              {/* Active Layers Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Active Layers</h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {getActiveLayersCount()} / {layers.length}
                  </Badge>
                </div>
              </div>

              {/* Layer Groups */}
              {layerGroups.map((group) => (
                <div key={group.id} className="mb-6">
                  <Button
                    variant="ghost"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full justify-between p-2 h-auto text-left hover:bg-accent/50"
                  >
                    <span className="font-medium text-foreground">{group.title}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {group.layers.length} layers
                      </Badge>
                      {expandedGroups[group.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </Button>

                  <AnimatePresence>
                    {expandedGroups[group.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-2">
                          {group.layers.map((layer) => (
                            <Tooltip key={layer.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="flex items-center space-x-3 p-3 rounded-lg bg-card/50 border border-border/50 cursor-pointer hover:bg-accent/50 transition-colors"
onClick={() => {
toggleLayerWithZoom(layer.id)
logLayerStates()
}}
                                >
                                  <div
                                    className="w-4 h-4 rounded border-2 flex-shrink-0 transition-all duration-200 flex items-center justify-center"
                                    style={{
                                      backgroundColor: layer.active ? layer.color : "transparent",
                                      borderColor: layer.color,
                                    }}
                                  >
                                    {layer.active && (
                                      <svg
                                        className="w-2.5 h-2.5 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      {layer.icon && (() => {
                                        const IconComponent = getIconComponent(layer.icon)
                                        return IconComponent ? <IconComponent className="h-4 w-4 text-muted-foreground" /> : null
                                      })()}
                                      <span className="font-medium text-sm text-foreground truncate">{layer.name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{layer.description}</p>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{layer.active ? "Hide Layer" : "Show Layer"}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}


            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  )
}
