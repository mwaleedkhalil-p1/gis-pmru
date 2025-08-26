"use client"

import { useEffect } from "react"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { MapContainer } from "@/components/MapContainer"
import { useMapStore } from "@/context/mapStore"
import { googleMapsLoader } from "@/lib/googleMapsLoader"

export default function Home() {
  const { initializeLayers, mapProvider, isFullscreen } = useMapStore()

  useEffect(() => {
    console.log("🏠 Home: Initializing app with mapProvider:", mapProvider)
    initializeLayers()
    console.log("🏠 Home: Called initializeLayers()")

    // Preload Google Maps immediately when app starts
    // This will start loading the script in the background
    if (mapProvider === "google") {
      googleMapsLoader.preload().catch(error => {
        console.warn("Google Maps preload failed:", error)
      })
    }
  }, [initializeLayers, mapProvider])

  // Preload Google Maps when user hovers over Google Maps button
  const handleGoogleMapsPreload = () => {
    googleMapsLoader.preload().catch(error => {
      console.warn("Google Maps preload on hover failed:", error)
    })
  }

  return (
    <div className="min-h-screen">
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Hide Header in fullscreen mode */}
        {!isFullscreen && <Header />}
        <div className="flex flex-1 overflow-hidden">
          {/* Hide Sidebar in fullscreen mode */}
          {!isFullscreen && <Sidebar />}
          <MapContainer />
        </div>
      </div>
    </div>
  )
}
