"use client"

import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import { useEffect } from "react"
import { MapControls } from "@/components/MapControls"
import { useMapStore } from "@/context/mapStore"

// Dynamically import the maps with reduced loading overhead
const DynamicLeafletMap = dynamic(() => import("@/components/SimpleMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
})

const DynamicGoogleMap = dynamic(() => import("@/components/GoogleMapAdvanced"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm text-gray-600">Preparing Google Maps...</p>
      </div>
    </div>
  ),
})

export function MapContainer() {
  const { isCollapsed, mapProvider, isFullscreen, forceLayerUpdate } = useMapStore()

  // Force layer update when map provider switches to ensure synchronization
  useEffect(() => {
    console.log(`📦 MapContainer: Map provider changed to ${mapProvider}`)
    
    // More conservative synchronization approach to prevent race conditions
    const timeouts = [
      setTimeout(() => {
        console.log(`📦 MapContainer: Forcing layer update (initial) for ${mapProvider}`)
        forceLayerUpdate()
      }, 150), // Increased initial delay to let map fully initialize
      setTimeout(() => {
        console.log(`📦 MapContainer: Forcing layer update (final) for ${mapProvider}`)
        forceLayerUpdate()
      }, 800) // Single follow-up after a longer delay
    ]

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [mapProvider, forceLayerUpdate])

  return (
    <motion.div
      className={`flex-1 relative bg-white ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
      style={
        isFullscreen
          ? {
              width: "100vw",
              height: "100vh",
              marginTop: 0,
              marginLeft: 0,
            }
          : {
              marginTop: "88px",
              height: "calc(100vh - 88px)",
            }
      }
      animate={
        isFullscreen
          ? {}
          : {
              marginLeft: isCollapsed ? "64px" : "320px",
            }
      }
      transition={{ duration: 0.3 }}
    >
      {/* Map Controls - Keep visible in fullscreen */}
      <MapControls />

      {/* Map */}
      <div className="w-full h-full">
        {mapProvider === "google" ? <DynamicGoogleMap /> : <DynamicLeafletMap />}
      </div>
    </motion.div>
  )
}
