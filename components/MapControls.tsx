"use client"

import { Map, Satellite, RotateCcw, Plus, Minus, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMapStore } from "@/context/mapStore"
import { googleMapsLoader } from "@/lib/googleMapsLoader"

export function MapControls() {
  const { mapType, mapProvider, setMapType, setMapProvider } = useMapStore()

  const handleZoomIn = () => {
    try {
      const event = new CustomEvent("mapZoomIn")
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Zoom in error:", error)
    }
  }

  const handleZoomOut = () => {
    try {
      const event = new CustomEvent("mapZoomOut")
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Zoom out error:", error)
    }
  }

  const handleResetView = () => {
    try {
      const event = new CustomEvent("mapResetView")
      window.dispatchEvent(event)
    } catch (error) {
      console.error("Reset view error:", error)
    }
  }

  const handleMapTypeChange = (type: "default" | "satellite") => {
    try {
      setMapType(type)
    } catch (error) {
      console.error("Map type change error:", error)
    }
  }

  const handleMapProviderChange = (provider: "leaflet" | "google") => {
    try {
      setMapProvider(provider)
    } catch (error) {
      console.error("Map provider change error:", error)
    }
  }

  const handleGoogleMapsPreload = () => {
    googleMapsLoader.preload().catch(error => {
      console.warn("Google Maps preload on hover failed:", error)
    })
  }

  return (
    <TooltipProvider>
      <div className="absolute top-4 left-4 z-50 space-y-3">
        {/* Map Provider Toggle */}
        <div className="map-control-group flex rounded-lg overflow-hidden border bg-white shadow-lg relative z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mapProvider === "leaflet" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapProviderChange("leaflet")}
                className={`rounded-none border-r flex-1 h-full w-full ${
                  mapProvider === "leaflet"
                    ? "bg-[#4285F4] hover:bg-[#3367D6] text-white border-[#4285F4] shadow-sm !m-0 !p-3"
                    : "hover:bg-gray-100 hover:text-gray-900 !m-0 !p-3"
                }`}
              >
                <Map className="h-4 w-4" />
                <span className="ml-2">Leaflet</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leaflet Maps</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mapProvider === "google" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapProviderChange("google")}
                onMouseEnter={handleGoogleMapsPreload}
                className={`rounded-none rounded-r-lg flex-1 h-full w-full ${
                  mapProvider === "google"
                    ? "bg-[#4285F4] hover:bg-[#3367D6] text-white border-[#4285F4] shadow-sm !border-r-[#4285F4] !m-0 !p-3"
                    : "hover:bg-gray-100 hover:text-gray-900 !m-0 !p-3"
                }`}
              >
                <Globe className="h-4 w-4" />
                <span className="ml-2">Google</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Google Maps</TooltipContent>
          </Tooltip>
        </div>

        {/* Map Type Toggle */}
        <div className="map-control-group flex rounded-lg overflow-hidden border border-gray-200 bg-white shadow-lg relative z-50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mapType === "default" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapTypeChange("default")}
                className={`rounded-none border-r flex-1 h-full w-full ${
                  mapType === "default"
                    ? "bg-[#4285F4] hover:bg-[#3367D6] text-white border-[#4285F4] shadow-sm !m-0 !p-3"
                    : "hover:bg-gray-100 hover:text-gray-900 !m-0 !p-3"
                }`}
              >
                <Map className="h-4 w-4" />
                <span className="ml-2">Default</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Default Map View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mapType === "satellite" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleMapTypeChange("satellite")}
                className={`rounded-none rounded-r-lg flex-1 h-full w-full ${
                  mapType === "satellite"
                    ? "bg-[#4285F4] hover:bg-[#3367D6] text-white border-[#4285F4] shadow-sm !border-r-[#4285F4] !m-0 !p-3"
                    : "hover:bg-gray-100 hover:text-gray-900 !m-0 !p-3"
                }`}
              >
                <Satellite className="h-4 w-4" />
                <span className="ml-2">Satellite</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Satellite View</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Zoom Controls - Moved to right side below fullscreen button */}
      <div className="absolute top-20 right-4 z-40 flex flex-col space-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomIn} 
              className="rounded-full h-10 w-10 bg-white shadow-lg border hover:bg-gray-50 flex items-center justify-center"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleZoomOut} 
              className="rounded-full h-10 w-10 bg-white shadow-lg border hover:bg-gray-50 flex items-center justify-center"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Zoom Out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleResetView} className="bg-white shadow-lg rounded-full h-10 w-10">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Reset Map View</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
