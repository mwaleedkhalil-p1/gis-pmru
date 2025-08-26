"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useMapStore } from "@/context/mapStore"
import { googleMapsLoader } from "@/lib/googleMapsLoader"

// Declare global google object
declare global {
  interface Window {
    google: any
    initGoogleMap: () => void
    initMap?: () => void
  }
}

export default function GoogleMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const dataLayersRef = useRef<Record<string, any>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const { mapType, isFullscreen, resetView, layers } = useMapStore()

  console.log("Google Maps component rendered, layers:", layers)

  // Debug: Log layers when component renders
  console.log("Google Maps component rendered with layers:", layers)

  // Function to load GeoJSON boundary layers
  const loadBoundaryLayers = async (map: any) => {
    try {
      console.log("Google Maps: Starting to load boundary layers. Available layers:", layers)
      for (const layer of layers) {
        console.log(`Google Maps: Checking layer: ${layer.name}, active: ${layer.active}, geojsonPath: ${layer.geojsonPath}`)
        if (layer.geojsonPath && layer.active) {
          console.log(`Google Maps: Loading active layer: ${layer.name}`)
          await loadGeoJSONLayer(map, layer)
        }
      }
      console.log("Google Maps: Finished loading boundary layers")
    } catch (error) {
      console.error("Google Maps: Error loading boundary layers:", error)
    }
  }

  // Function to load a single GeoJSON layer
  const loadGeoJSONLayer = async (map: any, layer: any) => {
    try {
      console.log(`Google Maps: Loading layer: ${layer.name} from ${layer.geojsonPath}`)
      console.log(`Google Maps: Fetching from URL: ${window.location.origin}${layer.geojsonPath}`)

      const response = await fetch(layer.geojsonPath)
      console.log(`Google Maps: Fetch response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        throw new Error(`Failed to load ${layer.name}: ${response.status} ${response.statusText}`)
      }

      const geojsonData = await response.json()
      console.log(`Google Maps: Successfully loaded ${layer.name}:`, geojsonData)

      // Remove existing layer if it exists
      if (dataLayersRef.current[layer.id]) {
        console.log(`Google Maps: Removing existing layer: ${layer.name}`)
        dataLayersRef.current[layer.id].setMap(null)
      }

      // Create a new Data instance for this layer
      console.log(`Google Maps: Creating new Data layer for ${layer.name}`)
      console.log("Google Maps: Checking if google.maps.Data is available:", !!window.google.maps.Data)

      if (!window.google.maps.Data) {
        throw new Error("Google Maps Data API is not available")
      }

      const dataLayer = new window.google.maps.Data({
        map: map
      })
      console.log("Google Maps: Data layer created successfully:", dataLayer)

      // Add GeoJSON data to the data layer
      console.log(`Google Maps: Adding GeoJSON data to data layer for ${layer.name}`)
      const features = dataLayer.addGeoJson(geojsonData)
      console.log(`Google Maps: Added ${features.length} features for ${layer.name}`)

      // Style the data layer with enhanced visibility for satellite view
      console.log(`Google Maps: Styling data layer for ${layer.name} with color ${layer.color}`)

      // Define enhanced styling for satellite view visibility (matching other components)
      let strokeWeight, strokeOpacity

      switch (layer.id) {
        case "Pakistan":
          strokeWeight = 4
          strokeOpacity = 1.0
          break
        case "khyber-pakhtunkhwa":
          strokeWeight = 3
          strokeOpacity = 1.0
          break
        case "divisions":
          strokeWeight = 3
          strokeOpacity = 0.95
          break
        case "districts":
          strokeWeight = 2
          strokeOpacity = 0.9
          break
        case "tehsils":
          strokeWeight = 2
          strokeOpacity = 0.85
          break
        default:
          strokeWeight = 2
          strokeOpacity = 0.9
      }

      // Enhanced styling for satellite view visibility with subtle fill and proper zIndex
      const getZIndex = (layerId: string): number => {
        switch (layerId) {
          case "Pakistan": return 1000 // Highest priority
          case "khyber-pakhtunkhwa": return 900
          case "divisions": return 800
          case "districts": return 700
          case "tehsils": return 600
          default: return 500
        }
      }

      dataLayer.setStyle({
        strokeColor: layer.color,
        strokeWeight: strokeWeight,
        strokeOpacity: strokeOpacity,
        fillColor: layer.color,
        fillOpacity: 0.08, // Subtle fill for better visibility on satellite imagery
        clickable: true,
        zIndex: getZIndex(layer.id)
      })

      // Add click listener for popups
      dataLayer.addListener('click', (event: any) => {
        console.log(`Google Maps: Click event on ${layer.name}`)
        const feature = event.feature

        if (feature && feature.forEachProperty) {
          let content = '<div style="max-width: 200px;">'
          const props: any = {}

          feature.forEachProperty((value: any, key: string) => {
            if (value && key !== "OBJECTID") {
              props[key] = value
            }
          })

          Object.entries(props).forEach(([key, value]) => {
            content += `<strong>${key}:</strong> ${value}<br>`
          })
          content += '</div>'

          if (Object.keys(props).length > 0) {
            const infoWindow = new window.google.maps.InfoWindow({
              content: content,
              position: event.latLng
            })
            infoWindow.open(map)
          }
        }
      })

      // Store layer reference
      dataLayersRef.current[layer.id] = dataLayer
      console.log(`Google Maps: Successfully added ${layer.name} to map`)

    } catch (error) {
      console.error(`Google Maps: Error loading ${layer.name}:`, error)
    }
  }

  // Load Google Maps API using advanced loader
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (googleMapsLoader.isReady()) {
          initializeMap()
          return
        }

        // Set up callbacks
        googleMapsLoader.onReady(() => {
          console.log("Google Maps ready via advanced loader")
          initializeMap()
        })

        googleMapsLoader.onError((error) => {
          console.error("Google Maps loading error:", error)
          setError(`Failed to load Google Maps: ${error.message}`)
          setIsLoaded(true)
        })

        // Start loading (will use preloaded script if available)
        await googleMapsLoader.load()
      } catch (err) {
        console.error("Error loading Google Maps:", err)
        // Try fallback method
        loadGoogleMapsFallback()
      }
    }

    const loadGoogleMapsFallback = async () => {
      try {
        // Check if bypass script is already loaded
        const existingScript = document.querySelector('script[src*="mapsJavaScriptAPI.js"]')
        if (existingScript) {
          // Use the same robust checking logic as for new script loads
          let attempts = 0
          const maxAttempts = 15
          const checkInterval = 300

          const checkExistingGoogleMaps = () => {
            attempts++

            if (window.google &&
                window.google.maps &&
                window.google.maps.Map &&
                window.google.maps.event) {

              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(initializeMap, 100)
              } else {
                document.addEventListener('DOMContentLoaded', () => {
                  setTimeout(initializeMap, 100)
                })
              }
            } else if (attempts < maxAttempts) {
              setTimeout(checkExistingGoogleMaps, checkInterval)
            } else {
              setError("Google Maps failed to initialize from existing script")
              setIsLoaded(true)
            }
          }

          checkExistingGoogleMaps()
          return
        }

        // Create script element for bypass
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/gh/somanchiu/Keyless-Google-Maps-API@v7.0/mapsJavaScriptAPI.js"
        script.async = true
        script.defer = true

        script.onload = () => {
          // Wait for Google Maps to be available with multiple attempts
          let attempts = 0
          const maxAttempts = 15
          const checkInterval = 300

          const checkGoogleMaps = () => {
            attempts++

            // Check if Google Maps API is fully loaded
            if (window.google &&
                window.google.maps &&
                window.google.maps.Map &&
                window.google.maps.event) {

              // Additional check to ensure DOM is ready
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(initializeMap, 100) // Small delay to ensure DOM is stable
              } else {
                document.addEventListener('DOMContentLoaded', () => {
                  setTimeout(initializeMap, 100)
                })
              }
            } else if (attempts < maxAttempts) {
              setTimeout(checkGoogleMaps, checkInterval)
            } else {
              setError("Google Maps failed to initialize after multiple attempts")
              setIsLoaded(true)
            }
          }

          checkGoogleMaps()
        }

        script.onerror = () => {
          console.error("Failed to load Google Maps bypass script")
          setError("Failed to load Google Maps bypass script. Please check your internet connection and try again.")
          setIsLoaded(true)
        }

        document.head.appendChild(script)
      } catch (err) {
        console.error("Error loading Google Maps:", err)
        setError("Failed to load Google Maps")
        setIsLoaded(true)
      }
    }

    const initializeMap = () => {
      if (!mapRef.current || !window.google || !window.google.maps) {
        console.log("Google Maps not ready yet")
        return
      }

      // Ensure the container has proper dimensions
      const container = mapRef.current
      if (!container.offsetWidth || !container.offsetHeight) {
        console.log("Map container not properly sized, retrying...")
        setTimeout(initializeMap, 100)
        return
      }

      try {
        setError(null)

        // Clean up any existing map instance
        if (mapInstanceRef.current) {
          try {
            // Clear any existing listeners
            window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
          } catch (e) {
            console.warn("Error clearing map listeners:", e)
          }
          mapInstanceRef.current = null
        }

        // Initialize Google Map with bypass script
        const map = new window.google.maps.Map(container, {
          center: { lat: 34.0151, lng: 71.5249 },
          zoom: 7,
          mapTypeId: mapType === "satellite" ? "hybrid" : "roadmap", // Use hybrid for satellite with labels
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          disableDefaultUI: true,
          styles: mapType === "default" ? [
            {
              featureType: "all",
              elementType: "labels.text",
              stylers: [{ visibility: "on" }]
            }
          ] : undefined
        })

        // Wait for map to be fully initialized
        window.google.maps.event.addListenerOnce(map, 'idle', () => {
          console.log("Google Maps 'idle' event fired")
          mapInstanceRef.current = map
          setIsLoaded(true)
          console.log("Google Maps initialized successfully")

          // Load initial boundary layers
          console.log("Google Maps: About to load boundary layers, current layers:", layers)
          console.log("Google Maps: Layers length:", layers.length)
          setTimeout(() => {
            console.log("Google Maps: Loading boundary layers after timeout, layers:", layers)
            loadBoundaryLayers(map)
          }, 500)
        })

        // Handle map initialization errors
        window.google.maps.event.addListener(map, 'error', (error: any) => {
          console.error("Google Maps error:", error)
          setError(`Map error: ${error.message || 'Unknown error'}`)
          setIsLoaded(true)
        })

        // Add event listeners for custom controls
        const handleZoomIn = () => {
          if (mapInstanceRef.current) {
            const currentZoom = mapInstanceRef.current.getZoom()
            mapInstanceRef.current.setZoom(currentZoom + 1)
          }
        }

        const handleZoomOut = () => {
          if (mapInstanceRef.current) {
            const currentZoom = mapInstanceRef.current.getZoom()
            mapInstanceRef.current.setZoom(currentZoom - 1)
          }
        }

        const handleResetView = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: 34.0151, lng: 71.5249 })
            mapInstanceRef.current.setZoom(7)
          }
        }

        // Remove existing listeners
        window.removeEventListener("mapZoomIn", handleZoomIn)
        window.removeEventListener("mapZoomOut", handleZoomOut)
        window.removeEventListener("mapResetView", handleResetView)

        // Add new listeners
        window.addEventListener("mapZoomIn", handleZoomIn)
        window.addEventListener("mapZoomOut", handleZoomOut)
        window.addEventListener("mapResetView", handleResetView)

      } catch (err) {
        console.error("Map initialization error:", err)
        setError(`Failed to initialize Google Maps: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setIsLoaded(true)
      }
    }

    loadGoogleMaps()

    return () => {
      // Cleanup map instance
      if (mapInstanceRef.current) {
        try {
          window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
        } catch (e) {
          console.warn("Error clearing map listeners on cleanup:", e)
        }
        mapInstanceRef.current = null
      }

      // Cleanup global functions
      if (window.initMap) {
        window.initMap = undefined as any
      }

      // Cleanup event listeners
      window.removeEventListener("mapZoomIn", () => {})
      window.removeEventListener("mapZoomOut", () => {})
      window.removeEventListener("mapResetView", () => {})
    }
  }, [])

  // Handle map type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    const updateMapType = () => {
      if (mapType === "satellite") {
        mapInstanceRef.current.setMapTypeId("hybrid") // Use hybrid for satellite with labels
      } else {
        mapInstanceRef.current.setMapTypeId("roadmap")
      }
    }

    updateMapType()
  }, [mapType, isLoaded])

  // Handle container resize
  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current && window.google && window.google.maps) {
        // Trigger map resize
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize')
      }
    })

    resizeObserver.observe(mapRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isLoaded])

  // Handle reset view
  useEffect(() => {
    if (resetView && mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.setCenter({ lat: 34.0151, lng: 71.5249 })
      mapInstanceRef.current.setZoom(7)
    }
  }, [resetView, isLoaded])

  // Handle layer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    const updateLayers = async () => {
      try {
        for (const layer of layers) {
          if (layer.geojsonPath) {
            if (layer.active) {
              // Load layer if it's active and not already loaded
              if (!dataLayersRef.current[layer.id]) {
                await loadGeoJSONLayer(mapInstanceRef.current, layer)
              }
            } else {
              // Remove layer if it's inactive
              if (dataLayersRef.current[layer.id]) {
                console.log(`Google Maps: Removing inactive layer: ${layer.name}`)
                // Remove the entire data layer from the map
                dataLayersRef.current[layer.id].setMap(null)
                delete dataLayersRef.current[layer.id]
              }
            }
          }
        }
      } catch (error) {
        console.error("Error updating layers:", error)
      }
    }

    updateLayers()
  }, [layers, isLoaded])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-600">
          <p>Error loading Google Maps: {error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsLoaded(false)
              window.location.reload()
            }}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className={`w-full h-full ${isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{
          minHeight: "400px",
          minWidth: "300px",
          background: "#f8f9fa",
          position: "relative",
          overflow: "hidden",
        }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading Google Maps...</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
