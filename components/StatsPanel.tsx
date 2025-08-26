"use client"

import { motion } from "framer-motion"
import { Activity, Layers, MapPin } from "lucide-react"
import { useMapStore } from "@/context/mapStore"

export function StatsPanel() {
  const { getActiveLayersCount } = useMapStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="absolute bottom-4 left-4 z-50"
    >
      <div className="bg-white/95 backdrop-blur-sm border rounded-lg shadow-lg p-4">
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span>
              Active Layers: <strong>{getActiveLayersCount()}/5</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span>
              Regions: <strong>5</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span>
              Status: <strong>Ready</strong>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
