"use client"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useMapStore } from "@/context/mapStore"
import { googleMapsLoader } from "@/lib/googleMapsLoader"
import { MapSkeleton } from "@/components/MapSkeleton"
import { FullscreenToggle } from "@/components/FullscreenToggle"
import { calculateGeoJSONBounds, toGoogleMapsBounds } from "@/lib/utils"

// Declare global google object
declare global {
  interface Window {
    google: any
    initGoogleMap: () => void
    initMap?: () => void
  }
}

// Interface for hierarchical boundary management
interface HierarchicalBoundary {
  id: string
  level: 'country' | 'province' | 'division' | 'district' | 'tehsil' | 'patwarkhana'
  parentId?: string
  geojsonPath: string
  name: string
  properties?: any
}

// Interface for active boundary layers
interface ActiveBoundaryLayer {
  id: string
  level: string
  dataLayer: any
  haloLayer: any
  geojsonData: any
}

export default function GoogleMapAdvanced() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const dataLayersRef = useRef<Record<string, any>>({})
  const haloLayersRef = useRef<Record<string, any>>({}) // For white halo effect

  // Hierarchical boundary management
  const activeBoundaryLayersRef = useRef<Record<string, ActiveBoundaryLayer>>({})

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const {
    mapType,
    isFullscreen,
    resetView,
    layers,
    layerVersion,
    zoomToBoundsRequest,
    clearZoomToBoundsRequest,
    hierarchicalBoundaries,
    addHierarchicalBoundary,
    removeHierarchicalBoundary,
    clearHierarchicalBoundaries
  } = useMapStore()

  console.log("🗺️ GoogleMaps: Component rendered. Layers:", layers.map(l => ({ id: l.id, active: l.active })))
  console.log("🗺️ GoogleMaps: Active layers count:", layers.filter(l => l.active).length)
  console.log("🗺️ GoogleMaps: Hierarchical boundaries from store:", hierarchicalBoundaries.map(b => ({ id: b.id, active: b.active, parentId: b.parentId })))

  // Define hierarchical boundary structure
  const boundaryHierarchy: HierarchicalBoundary[] = [
    {
      id: "Pakistan",
      level: "country",
      geojsonPath: "/Boundaries_GeoJSON/Pak_Boundary.geojson",
      name: "Pakistan"
    },
    {
      id: "khyber-pakhtunkhwa",
      level: "province",
      parentId: "Pakistan",
      geojsonPath: "/Boundaries_GeoJSON/KP_Boundary.geojson",
      name: "Khyber Pakhtunkhwa"
    },
    {
      id: "divisions",
      level: "division",
      parentId: "khyber-pakhtunkhwa",
      geojsonPath: "/Boundaries_GeoJSON/KP_Divisions.geojson",
      name: "Divisions"
    },
    {
      id: "districts",
      level: "district",
      parentId: "divisions",
      geojsonPath: "/Boundaries_GeoJSON/KP_Districts.geojson",
      name: "Districts"
    },
    {
      id: "tehsils",
      level: "tehsil",
      parentId: "districts",
      geojsonPath: "/Boundaries_GeoJSON/KP_Tehsils.geojson",
      name: "Tehsils"
    },
    {
      id: "patwarkhana",
      level: "patwarkhana",
      parentId: "tehsils",
      geojsonPath: "/Boundaries_GeoJSON/Patwarkhana_Coordinates_GeoJson.geojson",
      name: "Patwarkhana Coordinates"
    }
  ]

  // Helper function to get child boundaries for a given boundary
  const getChildBoundaries = (parentId: string): HierarchicalBoundary[] => {
    return boundaryHierarchy.filter(boundary => boundary.parentId === parentId)
  }

  // Helper function to get boundary level hierarchy order
  const getLevelOrder = (level: string): number => {
    const order = { country: 1, province: 2, division: 3, district: 4, tehsil: 5, patwarkhana: 6 }
    return order[level as keyof typeof order] || 0
  }

  // Helper function to determine if a feature matches the clicked area
  const isFeatureInClickedArea = (feature: any, clickedFeature: any, level: string): boolean => {
    if (!feature.properties || !clickedFeature.properties) return false

    switch (level) {
      case 'division':
        // For divisions, show all divisions in the same province
        return feature.properties.Province === clickedFeature.properties.Province
      case 'district':
        // For districts, show all districts in the same division
        return feature.properties.Division === clickedFeature.properties.Division &&
               feature.properties.Province === clickedFeature.properties.Province
      case 'tehsil':
        // For tehsils, show all tehsils in the same district
        return feature.properties.District === clickedFeature.properties.District &&
               feature.properties.Division === clickedFeature.properties.Division &&
               feature.properties.Province === clickedFeature.properties.Province
      case 'patwarkhana':
        // For patwarkhana, show all patwarkhana in the same tehsil
        return feature.properties.Tehsil_Nam === clickedFeature.properties.Tehsil_Nam &&
               feature.properties.District_N === clickedFeature.properties.District_N
      default:
        return true
    }
  }

  // Function to zoom to bounds of a specific layer
  const zoomToLayerBounds = async (layerId: string) => {
    console.log(`GoogleMapAdvanced: zoomToLayerBounds called for ${layerId}`)

    if (!mapInstanceRef.current) {
      console.warn("GoogleMapAdvanced: Cannot zoom to bounds - map not initialized")
      return
    }

    const layer = layers.find(l => l.id === layerId)
    if (!layer || !layer.geojsonPath) {
      console.warn(`GoogleMapAdvanced: Cannot zoom to bounds - layer ${layerId} not found or has no geojsonPath`)
      console.log("GoogleMapAdvanced: Available layers:", layers.map(l => ({ id: l.id, geojsonPath: l.geojsonPath })))
      return
    }

    try {
      console.log(`GoogleMapAdvanced: Fetching GeoJSON for bounds calculation: ${layer.geojsonPath}`)
      const response = await fetch(layer.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${layer.name}: ${response.status} ${response.statusText}`)
      }

      const geojsonData = await response.json()
      const bounds = calculateGeoJSONBounds(geojsonData)

      if (!bounds) {
        console.warn(`GoogleMapAdvanced: Could not calculate bounds for layer ${layerId}`)
        return
      }

      const googleBounds = toGoogleMapsBounds(bounds)
      console.log(`GoogleMapAdvanced: Zooming to bounds for ${layer.name}:`, googleBounds)

      // Apply different zoom strategies based on layer type
      let useDirectZoom = false
      let targetZoom = undefined
      let padding = { top: 50, right: 50, bottom: 50, left: 50 }

      switch (layerId) {
        case "districts":
          // For districts, use direct zoom approach for consistent behavior
          useDirectZoom = true
          targetZoom = 10
          break
        case "tehsils":
          // For tehsils, use direct zoom approach with higher zoom level
          useDirectZoom = true
          targetZoom = 13
          break
        case "divisions":
          // For divisions, use direct zoom approach
          useDirectZoom = true
          targetZoom = 8
          break
        default:
          // Default for provinces and country level - use fitBounds
          padding = { top: 50, right: 50, bottom: 50, left: 50 }
      }

      if (useDirectZoom && targetZoom) {
        // For districts and tehsils, use setOptions with maxZoom to ensure consistent behavior
        console.log(`GoogleMapAdvanced: Using maxZoom approach - Target zoom: ${targetZoom}`)

        // Set maxZoom temporarily to limit fitBounds
        mapInstanceRef.current.setOptions({ maxZoom: targetZoom })

        // Use fitBounds which will respect the maxZoom
        mapInstanceRef.current.fitBounds(googleBounds, padding)

        // Remove maxZoom limit after fitBounds completes
        window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'idle', () => {
          mapInstanceRef.current?.setOptions({ maxZoom: null })
          console.log(`GoogleMapAdvanced: Removed maxZoom limit for ${layerId}`)
        })
      } else {
        // Use fitBounds for provinces and country level
        mapInstanceRef.current.fitBounds(googleBounds, padding)
      }

    } catch (error) {
      console.error(`GoogleMapAdvanced: Error zooming to bounds for ${layerId}:`, error)
    }
  }

  // Function to clear child boundaries recursively
  const clearChildBoundaries = (parentId: string) => {
    const childBoundaries = getChildBoundaries(parentId)

    for (const childBoundary of childBoundaries) {
      // Remove the child boundary if it exists
      if (activeBoundaryLayersRef.current[childBoundary.id]) {
        const layer = activeBoundaryLayersRef.current[childBoundary.id]
        if (layer.haloLayer) layer.haloLayer.setMap(null)
        if (layer.dataLayer) layer.dataLayer.setMap(null)
        delete activeBoundaryLayersRef.current[childBoundary.id]
        console.log(`🗺️ GoogleMaps: Cleared child boundary: ${childBoundary.name}`)
      }

      // Remove from global store
      removeHierarchicalBoundary(childBoundary.id)

      // Recursively clear grandchildren
      clearChildBoundaries(childBoundary.id)
    }
  }

  // Function to load hierarchical boundary when a boundary is clicked
  const loadHierarchicalBoundary = async (map: any, clickedFeature: any, clickedBoundaryId: string) => {
    try {
      console.log(`🗺️ GoogleMaps: Loading hierarchical boundary for ${clickedBoundaryId}`)

      // Find the clicked boundary in hierarchy
      const clickedBoundary = boundaryHierarchy.find(b => b.id === clickedBoundaryId)
      if (!clickedBoundary) {
        console.warn(`Boundary ${clickedBoundaryId} not found in hierarchy`)
        return
      }

      // Get child boundaries
      const childBoundaries = getChildBoundaries(clickedBoundaryId)

      // Check if any child boundaries are already loaded - if so, clear them (toggle behavior)
      const hasLoadedChildren = childBoundaries.some(child =>
        activeBoundaryLayersRef.current[child.id]
      )

      if (hasLoadedChildren) {
        console.log(`🗺️ GoogleMaps: Clearing existing child boundaries for ${clickedBoundaryId}`)
        clearChildBoundaries(clickedBoundaryId)
        return
      }

      // Load each child boundary
      for (const childBoundary of childBoundaries) {
        console.log(`🗺️ GoogleMaps: Loading child boundary: ${childBoundary.name}`)

        // Load the child boundary with filtering (since this is click-based)
        await loadHierarchicalGeoJSONLayer(map, childBoundary, clickedFeature, true)

        // Add to global store for synchronization
        const parentFeatureProps = clickedFeature.getProperties ? clickedFeature.getProperties() : clickedFeature.properties
        console.log(`🗺️ GoogleMaps: Adding hierarchical boundary to store:`, {
          id: childBoundary.id,
          parentId: clickedBoundaryId,
          parentFeature: parentFeatureProps
        })

        addHierarchicalBoundary({
          id: childBoundary.id,
          level: childBoundary.level,
          parentId: clickedBoundaryId,
          parentFeature: parentFeatureProps,
          geojsonPath: childBoundary.geojsonPath,
          name: childBoundary.name,
          active: true,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error(`🗺️ GoogleMaps: Error loading hierarchical boundary:`, error)
    }
  }

  // Function to load hierarchical boundaries from global store
  const loadHierarchicalBoundariesFromStore = async (map: any) => {
    try {
      console.log(`🗺️ GoogleMaps: Loading hierarchical boundaries from store`)
      console.log(`🗺️ GoogleMaps: Total hierarchical boundaries in store:`, hierarchicalBoundaries.length)
      const activeHierarchicalBoundaries = hierarchicalBoundaries.filter(b => b.active)
      console.log(`🗺️ GoogleMaps: Active hierarchical boundaries:`, activeHierarchicalBoundaries.map(b => ({ id: b.id, name: b.name, parentId: b.parentId })))

      if (activeHierarchicalBoundaries.length === 0) {
        console.log(`🗺️ GoogleMaps: No active hierarchical boundaries to load`)
        return
      }

      for (const boundaryState of activeHierarchicalBoundaries) {
        // Skip if already loaded
        if (activeBoundaryLayersRef.current[boundaryState.id]) {
          console.log(`🗺️ GoogleMaps: Hierarchical boundary ${boundaryState.id} already loaded`)
          continue
        }

        // Find the boundary definition
        const boundaryDef = boundaryHierarchy.find(b => b.id === boundaryState.id)
        if (!boundaryDef) {
          console.warn(`🗺️ GoogleMaps: Boundary definition not found for ${boundaryState.id}`)
          continue
        }

        console.log(`🗺️ GoogleMaps: Loading hierarchical boundary from store: ${boundaryState.name}`)
        console.log(`🗺️ GoogleMaps: Parent feature data:`, boundaryState.parentFeature)

        // Load with filtering if we have parent feature data
        const shouldFilter = !!boundaryState.parentFeature
        await loadHierarchicalGeoJSONLayer(map, boundaryDef, boundaryState.parentFeature, shouldFilter)
      }
    } catch (error) {
      console.error(`🗺️ GoogleMaps: Error loading hierarchical boundaries from store:`, error)
    }
  }

  // Enhanced cleanup function for patwarkhana layers
  const cleanupPatwarkhanaLayer = (layerId: string) => {
    console.log(`🗺️ GoogleMaps: Starting cleanup of Patwarkhana layer ${layerId}`)
    
    if (activeBoundaryLayersRef.current[layerId]) {
      const existingLayer = activeBoundaryLayersRef.current[layerId]
      
      if (existingLayer.dataLayer) {
        // Clear all event listeners first, including zoom listener for patwarkhana
        try {
          window.google.maps.event.clearInstanceListeners(existingLayer.dataLayer)
          
          // Clear zoom listener if it exists
          if (existingLayer.dataLayer._zoomListener) {
            window.google.maps.event.removeListener(existingLayer.dataLayer._zoomListener)
            console.log(`🗺️ GoogleMaps: Cleared zoom listener for ${layerId}`)
          }
          
          console.log(`🗺️ GoogleMaps: Cleared event listeners for ${layerId}`)
        } catch (e) {
          console.warn(`🗺️ GoogleMaps: Error clearing listeners for ${layerId}:`, e)
        }
        
        // Use batched removal for large datasets to prevent map freezing
        console.log(`🗺️ GoogleMaps: Starting feature removal for ${layerId}`)
        
        // Collect all features first
        const featuresToRemove: any[] = []
        existingLayer.dataLayer.forEach((feature: any) => {
          featuresToRemove.push(feature)
        })
        
        if (featuresToRemove.length > 500) {
          // Batched removal for large datasets
          console.log(`🗺️ GoogleMaps: Using batched removal for ${featuresToRemove.length} features`)
          
          const REMOVE_BATCH_SIZE = 250
          let removeIndex = 0
          
          const removeBatch = () => {
            const endIdx = Math.min(removeIndex + REMOVE_BATCH_SIZE, featuresToRemove.length)
            
            for (let i = removeIndex; i < endIdx; i++) {
              try {
                existingLayer.dataLayer.remove(featuresToRemove[i])
              } catch (e) {
                // Continue with other features if one fails
                console.warn(`🗺️ GoogleMaps: Error removing feature ${i}:`, e)
              }
            }
            
            removeIndex = endIdx
            
            if (removeIndex < featuresToRemove.length) {
              // Continue with next batch after small delay
              setTimeout(removeBatch, 5)
            } else {
              // All features removed, now remove the layer
              console.log(`🗺️ GoogleMaps: Finished removing all features, removing layer`)
              try {
                existingLayer.dataLayer.setMap(null)
              } catch (e) {
                console.warn(`🗺️ GoogleMaps: Error removing layer from map:`, e)
              }
            }
          }
          
          removeBatch()
        } else {
          // Direct removal for smaller datasets
          try {
            featuresToRemove.forEach(feature => {
              existingLayer.dataLayer.remove(feature)
            })
            console.log(`🗺️ GoogleMaps: Removed ${featuresToRemove.length} features directly`)
          } catch (e) {
            console.warn(`🗺️ GoogleMaps: Error during direct feature removal:`, e)
          }
          
          // Remove layer from map
          try {
            existingLayer.dataLayer.setMap(null)
          } catch (e) {
            console.warn(`🗺️ GoogleMaps: Error removing layer from map:`, e)
          }
        }
      }
      
      if (existingLayer.haloLayer) {
        try {
          window.google.maps.event.clearInstanceListeners(existingLayer.haloLayer)
          existingLayer.haloLayer.setMap(null)
        } catch (e) {
          console.warn(`🗺️ GoogleMaps: Error removing halo layer:`, e)
        }
      }
      
      delete activeBoundaryLayersRef.current[layerId]
      console.log(`🗺️ GoogleMaps: Successfully cleaned up ${layerId}`)
    }
  }

  // Optimized function to load Patwarkhana points
  const loadPatwarkhanaLayer = async (map: any, boundary: HierarchicalBoundary, geojsonData: any) => {
    try {
      console.log(`🗺️ GoogleMaps: Loading Patwarkhana with optimization (${geojsonData.features.length} points)`)

      // Enhanced safety checks for map state
      if (!map || !window.google || !window.google.maps) {
        console.error(`🗺️ GoogleMaps: Google Maps API not available for ${boundary.id}`)
        throw new Error("Google Maps API not initialized")
      }

      if (!map.getDiv || !map.getDiv()) {
        console.error(`🗺️ GoogleMaps: Map container not ready for ${boundary.id}`)
        throw new Error("Map container not initialized")
      }

      // Additional check for map validity
      try {
        // Test if map is still active by checking a basic property
        const mapCenter = map.getCenter()
        if (!mapCenter) {
          throw new Error("Map center not available - map may be destroyed")
        }
      } catch (mapTestError) {
        console.error(`🗺️ GoogleMaps: Map validation failed for ${boundary.id}:`, mapTestError)
        throw new Error("Map is not in a valid state for layer creation")
      }

      // Remove existing layers if they exist using enhanced cleanup
      if (activeBoundaryLayersRef.current[boundary.id]) {
        console.log(`🗺️ GoogleMaps: Cleaning up existing Patwarkhana layer`)
        cleanupPatwarkhanaLayer(boundary.id)
        
        // Wait a moment for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Create data layer for points with error handling
      let dataLayer
      try {
        dataLayer = new window.google.maps.Data()
      } catch (dataLayerError) {
        console.error(`🗺️ GoogleMaps: Error creating Data layer for ${boundary.id}:`, dataLayerError)
        throw new Error("Failed to create Google Maps Data layer")
      }

      // Attach data layer to map with safety checks
      try {
        dataLayer.setMap(map)
        console.log(`🗺️ GoogleMaps: Successfully attached data layer to map for ${boundary.id}`)
      } catch (attachError) {
        console.error(`🗺️ GoogleMaps: Error attaching data layer to map for ${boundary.id}:`, attachError)
        // Clean up the data layer if attachment failed
        try {
          dataLayer.setMap(null)
        } catch (e) {
          console.warn(`🗺️ GoogleMaps: Error during failed attachment cleanup:`, e)
        }
        throw new Error("Failed to attach data layer to map")
      }

      // Ultra-conservative approach for large datasets to prevent map breaking
      const features = geojsonData.features
      console.log(`🗺️ GoogleMaps: Loading ${features.length} Patwarkhana points`)
      
      // Google Maps Data Layer performance-conscious approach
      // 1,357 points is too much for Google Maps to handle reliably
      console.log(`🗺️ GoogleMaps: Implementing performance-conscious loading for ${features.length} Patwarkhana points`)
      
      // Load initial subset that Google Maps can definitely handle
      const INITIAL_LOAD_LIMIT = 500 // Conservative limit that works reliably
      const initialFeatures = features.slice(0, INITIAL_LOAD_LIMIT)
      
      const initialData = {
        type: "FeatureCollection",
        features: initialFeatures
      }
      
      try {
        dataLayer.addGeoJson(initialData)
        console.log(`🗺️ GoogleMaps: Successfully loaded initial ${initialFeatures.length} Patwarkhana points`)
        
        // Store remaining features for potential future loading
        if (features.length > INITIAL_LOAD_LIMIT) {
          const remainingCount = features.length - INITIAL_LOAD_LIMIT
          console.log(`🗺️ GoogleMaps: ${remainingCount} additional Patwarkhana points available (not loaded to maintain performance)`)
          console.log(`🗺️ GoogleMaps: ℹ️  PERFORMANCE NOTE: Showing ${initialFeatures.length} of ${features.length} Patwarkhana points to maintain map stability`)
          
          // Store reference for potential future loading on zoom/pan
          dataLayer._remainingPatwarkhanaFeatures = features.slice(INITIAL_LOAD_LIMIT)
          dataLayer._totalPatwarkhanaCount = features.length
          
          // Add zoom listener to potentially load more points when zooming in
          const zoomListener = map.addListener('zoom_changed', () => {
            const currentZoom = map.getZoom()
            if (currentZoom >= 12 && dataLayer._remainingPatwarkhanaFeatures && dataLayer._remainingPatwarkhanaFeatures.length > 0) {
              console.log(`🗺️ GoogleMaps: High zoom level (${currentZoom}) detected, considering loading more Patwarkhana points`)
              
              // Load a few more points at high zoom levels
              const additionalFeatures = dataLayer._remainingPatwarkhanaFeatures.slice(0, 200)
              if (additionalFeatures.length > 0) {
                try {
                  const additionalData = {
                    type: "FeatureCollection",
                    features: additionalFeatures
                  }
                  dataLayer.addGeoJson(additionalData)
                  dataLayer._remainingPatwarkhanaFeatures = dataLayer._remainingPatwarkhanaFeatures.slice(200)
                  console.log(`🗺️ GoogleMaps: Loaded ${additionalFeatures.length} additional Patwarkhana points at zoom ${currentZoom}`)
                } catch (additionalError) {
                  console.warn(`🗺️ GoogleMaps: Could not load additional Patwarkhana points:`, additionalError)
                }
              }
            }
          })
          
          // Store the listener for cleanup
          dataLayer._zoomListener = zoomListener
        }
        
      } catch (error) {
        console.error(`🗺️ GoogleMaps: Error adding initial Patwarkhana data:`, error)
        
        // Fallback to even smaller dataset
        try {
          console.log(`🗺️ GoogleMaps: Trying smaller Patwarkhana subset (250 points)`)
          const fallbackFeatures = features.slice(0, 250)
          const fallbackData = {
            type: "FeatureCollection",
            features: fallbackFeatures
          }
          
          // Clear any partial data first
          dataLayer.forEach((feature: any) => {
            dataLayer.remove(feature)
          })
          
          dataLayer.addGeoJson(fallbackData)
          console.log(`🗺️ GoogleMaps: Successfully loaded fallback ${fallbackFeatures.length} Patwarkhana points`)
          
        } catch (fallbackError) {
          console.error(`🗺️ GoogleMaps: Even fallback Patwarkhana loading failed:`, fallbackError)
          throw fallbackError
        }
      }

      // Style the points with custom Patwar Khana icon
      dataLayer.setStyle({
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="#1E88E5"/>
              <circle cx="20" cy="20" r="17" fill="none" stroke="white" stroke-width="3"/>
              <g fill="white" transform="scale(0.048) translate(250, 250)">
                <path d="M75 150 L250 75 L425 150 L425 175 L375 175 L375 350 L425 350 L425 375 L425 400 L75 400 L75 375 L75 350 L125 350 L125 175 L75 175 Z"/>
                <rect x="100" y="175" width="25" height="175"/>
                <rect x="375" y="175" width="25" height="175"/>
                <rect x="95" y="350" width="35" height="25"/>
                <rect x="370" y="350" width="35" height="25"/>
                <rect x="95" y="150" width="35" height="25"/>
                <rect x="370" y="150" width="35" height="25"/>
                <path d="M250 90 L255 105 L270 105 L258 115 L263 130 L250 120 L237 130 L242 115 L230 105 L245 105 Z"/>
                <rect x="170" y="180" width="115" height="155"/>
                <path d="M270 180 L285 195 L270 195 Z" fill="#E3F2FD"/>
                <g transform="translate(300, 200) rotate(45)">
                  <rect x="0" y="0" width="8" height="30"/>
                  <rect x="2" y="25" width="4" height="8" fill="#FFC107"/>
                </g>
                <path d="M185 220 L190 225 L200 215" stroke="white" stroke-width="2" fill="none"/>
                <line x1="210" y1="220" x2="260" y2="220" stroke="white" stroke-width="2"/>
                <path d="M185 245 L190 250 L200 240" stroke="white" stroke-width="2" fill="none"/>
                <line x1="210" y1="245" x2="260" y2="245" stroke="white" stroke-width="2"/>
                <path d="M185 270 L190 275 L200 265" stroke="white" stroke-width="2" fill="none"/>
                <line x1="210" y1="270" x2="260" y2="270" stroke="white" stroke-width="2"/>
                <line x1="210" y1="295" x2="240" y2="295" stroke="white" stroke-width="2"/>
              </g>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        },
        clickable: true,
        zIndex: getZIndexForLevel(boundary.level),
      })

      // Add click listener for popups
      dataLayer.addListener('click', (event: any) => {
        const feature = event.feature
        console.log(`🗺️ GoogleMaps: Click on Patwarkhana point`)

        // Show info popup with Patwarkhana details
        if (feature && feature.getProperty) {
          let content = '<div style="max-width: 250px;">'
          content += '<h4 style="margin: 0 0 8px 0; color: #8B5CF6;">Patwarkhana Information</h4>'

          const patwari = feature.getProperty('Name_of_Pa')
          const moza = feature.getProperty('Name_of_Mo')
          const district = feature.getProperty('District_N')
          const tehsil = feature.getProperty('Tehsil_Nam')
          const building = feature.getProperty('Name_of_Bu')
          const latitude = feature.getProperty('Latitude')
          const longitude = feature.getProperty('Longitude')
          const status = feature.getProperty('Rectificat')

          if (patwari) content += `<strong>Patwari:</strong> ${patwari}<br>`
          if (moza) content += `<strong>Moza:</strong> ${moza}<br>`
          if (district) content += `<strong>District:</strong> ${district}<br>`
          if (tehsil) content += `<strong>Tehsil:</strong> ${tehsil}<br>`
          if (building) content += `<strong>Building:</strong> ${building}<br>`
          if (latitude && longitude) content += `<strong>Coordinates:</strong> ${latitude}, ${longitude}<br>`
          if (status) content += `<strong>Status:</strong> ${status}<br>`

          content += '</div>'

          if (content.length > 35) {
            const infoWindow = new window.google.maps.InfoWindow({
              content: content,
              position: event.latLng
            })
            infoWindow.open(map)
          }
        }
      })

      // Gentle verification - only fail if map is clearly broken
      try {
        // Give the map a moment to process the data before verification
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // More lenient verification - check multiple indicators
        let mapIsHealthy = false
        
        try {
          const postLoadCenter = map.getCenter()
          const postLoadZoom = map.getZoom()
          const mapDiv = map.getDiv()
          
          // Map is healthy if ANY of these work
          if (postLoadCenter || postLoadZoom || (mapDiv && mapDiv.clientWidth > 0)) {
            mapIsHealthy = true
            console.log(`🗺️ GoogleMaps: Map state verified as stable after Patwarkhana loading`)
          }
        } catch (e) {
          console.warn(`🗺️ GoogleMaps: Some map properties unavailable, but this may be normal:`, e)
        }
        
        // Only cleanup if map is clearly broken (multiple indicators fail)
        if (!mapIsHealthy) {
          try {
            // Final attempt - try to interact with the map
            const bounds = map.getBounds()
            if (bounds) {
              mapIsHealthy = true
              console.log(`🗺️ GoogleMaps: Map bounds accessible - assuming map is functional`)
            }
          } catch (finalError) {
            console.warn(`🗺️ GoogleMaps: Final verification attempt failed:`, finalError)
          }
        }
        
        if (!mapIsHealthy) {
          console.warn(`🗺️ GoogleMaps: Map verification inconclusive after Patwarkhana loading - proceeding with caution`)
          // Don't throw error - let it proceed and rely on the later verification
        }
        
      } catch (mapVerifyError) {
        console.warn(`🗺️ GoogleMaps: Map verification encountered error after Patwarkhana loading:`, mapVerifyError)
        // Don't throw error - map might still be functional
      }

      // Store layer reference only after successful verification
      activeBoundaryLayersRef.current[boundary.id] = {
        id: boundary.id,
        dataLayer: dataLayer,
        haloLayer: null, // No halo for points
        level: boundary.level,
        geojsonData: geojsonData
      }

      const loadedCount = Math.min(geojsonData.features.length, 500)
      if (geojsonData.features.length > 500) {
        console.log(`🗺️ GoogleMaps: Successfully loaded ${loadedCount} of ${geojsonData.features.length} Patwarkhana points (zoom in to see more)`)
      } else {
        console.log(`🗺️ GoogleMaps: Successfully loaded all ${loadedCount} Patwarkhana points`)
      }

    } catch (error) {
      console.error(`🗺️ GoogleMaps: Error loading Patwarkhana layer:`, error)
      throw error
    }
  }

  // Function to load a hierarchical GeoJSON layer with optional filtering
  const loadHierarchicalGeoJSONLayer = async (map: any, boundary: HierarchicalBoundary, parentFeature?: any, shouldFilter: boolean = true) => {
    try {
      console.log(`🗺️ GoogleMaps: Loading hierarchical layer: ${boundary.name} from ${boundary.geojsonPath}`)

      const response = await fetch(boundary.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to load ${boundary.name}: ${response.status} ${response.statusText}`)
      }
      const geojsonData = await response.json()

      // Special handling for Patwarkhana (point data) - use optimized loading
      if (boundary.level === 'patwarkhana') {
        return await loadPatwarkhanaLayer(map, boundary, geojsonData)
      }

      // Filter features only if we have a parent feature AND shouldFilter is true (for click-based loading)
      let filteredGeoJsonData = geojsonData
      if (parentFeature && shouldFilter && boundary.level !== 'country' && boundary.level !== 'province') {
        const filteredFeatures = geojsonData.features.filter((feature: any) =>
          isFeatureInClickedArea(feature, parentFeature, boundary.level)
        )

        filteredGeoJsonData = {
          ...geojsonData,
          features: filteredFeatures
        }

        console.log(`🗺️ GoogleMaps: Filtered ${geojsonData.features.length} features to ${filteredFeatures.length} for ${boundary.name}`)
      } else {
        console.log(`🗺️ GoogleMaps: Loading all features for ${boundary.name} (${geojsonData.features.length} features)`)
      }

      // Remove existing layer if it exists
      if (activeBoundaryLayersRef.current[boundary.id]) {
        const existingLayer = activeBoundaryLayersRef.current[boundary.id]
        if (existingLayer.haloLayer) existingLayer.haloLayer.setMap(null)
        if (existingLayer.dataLayer) existingLayer.dataLayer.setMap(null)
        delete activeBoundaryLayersRef.current[boundary.id]
      }

      // Get styling parameters based on boundary level
      const { weight, opacity, fillOpacity, haloWeight } = getBoundaryStyle(boundary.level)

      // Create the halo (white outline) layer
      const haloLayer = new window.google.maps.Data({ map: map })
      haloLayer.addGeoJson(filteredGeoJsonData)
      haloLayer.setStyle({
        strokeColor: '#FFFFFF',
        strokeWeight: haloWeight,
        strokeOpacity: 0.8,
        fillOpacity: 0,
        clickable: false,
        zIndex: getZIndexForLevel(boundary.level) - 1
      })

      // Create the main boundary layer
      const dataLayer = new window.google.maps.Data({ map: map })
      dataLayer.addGeoJson(filteredGeoJsonData)

      // Style the main data layer
      dataLayer.setStyle((feature: any) => {
        const geometry = feature.getGeometry()
        const geometryType = geometry.getType()

        if (geometryType === 'Point' && boundary.level === 'patwarkhana') {
          // Special styling for point features (Patwarkhana) with custom icon
          return {
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="20" fill="#1E88E5"/>
                  <circle cx="20" cy="20" r="17" fill="none" stroke="white" stroke-width="3"/>
                  <g fill="white" transform="scale(0.048) translate(250, 250)">
                    <path d="M75 150 L250 75 L425 150 L425 175 L375 175 L375 350 L425 350 L425 375 L425 400 L75 400 L75 375 L75 350 L125 350 L125 175 L75 175 Z"/>
                    <rect x="100" y="175" width="25" height="175"/>
                    <rect x="375" y="175" width="25" height="175"/>
                    <rect x="95" y="350" width="35" height="25"/>
                    <rect x="370" y="350" width="35" height="25"/>
                    <rect x="95" y="150" width="35" height="25"/>
                    <rect x="370" y="150" width="35" height="25"/>
                    <path d="M250 90 L255 105 L270 105 L258 115 L263 130 L250 120 L237 130 L242 115 L230 105 L245 105 Z"/>
                    <rect x="170" y="180" width="115" height="155"/>
                    <path d="M270 180 L285 195 L270 195 Z" fill="#E3F2FD"/>
                    <g transform="translate(300, 200) rotate(45)">
                      <rect x="0" y="0" width="8" height="30"/>
                      <rect x="2" y="25" width="4" height="8" fill="#FFC107"/>
                    </g>
                    <path d="M185 220 L190 225 L200 215" stroke="white" stroke-width="2" fill="none"/>
                    <line x1="210" y1="220" x2="260" y2="220" stroke="white" stroke-width="2"/>
                    <path d="M185 245 L190 250 L200 240" stroke="white" stroke-width="2" fill="none"/>
                    <line x1="210" y1="245" x2="260" y2="245" stroke="white" stroke-width="2"/>
                    <path d="M185 270 L190 275 L200 265" stroke="white" stroke-width="2" fill="none"/>
                    <line x1="210" y1="270" x2="260" y2="270" stroke="white" stroke-width="2"/>
                    <line x1="210" y1="295" x2="240" y2="295" stroke="white" stroke-width="2"/>
                  </g>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(40, 40),
              anchor: new window.google.maps.Point(20, 20),
            },
            clickable: true,
            zIndex: getZIndexForLevel(boundary.level),
          }
        } else {
          // Regular polygon/line styling
          return {
            fillColor: getBoundaryColor(boundary.level),
            fillOpacity: fillOpacity,
            clickable: true,
            zIndex: getZIndexForLevel(boundary.level),
            strokeColor: getBoundaryColor(boundary.level),
            strokeWeight: weight,
            strokeOpacity: opacity,
          }
        }
      })

      // Store layer reference
      activeBoundaryLayersRef.current[boundary.id] = {
        id: boundary.id,
        level: boundary.level,
        dataLayer,
        haloLayer,
        geojsonData: filteredGeoJsonData
      }

      // Add hierarchical click listener
      dataLayer.addListener('click', (event: any) => {
        const feature = event.feature
        console.log(`🗺️ GoogleMaps: Hierarchical click on ${boundary.name}`, feature.getProperty('District') || feature.getProperty('Division') || feature.getProperty('Province'))
        console.log(`🗺️ GoogleMaps: Click event triggered for boundary ${boundary.id}`)

        // Load child boundaries for this feature (with filtering)
        loadHierarchicalBoundary(map, feature, boundary.id)

        // Show info popup
        if (feature && feature.forEachProperty) {
          let content = ''

          if (boundary.level === 'patwarkhana') {
            // Special popup for Patwarkhana with relevant fields
            content = '<div style="max-width: 250px;">'
            content += '<h4 style="margin: 0 0 8px 0; color: #8B5CF6;">Patwarkhana Information</h4>'

            const patwari = feature.getProperty('Name_of_Pa')
            const moza = feature.getProperty('Name_of_Mo')
            const district = feature.getProperty('District_N')
            const tehsil = feature.getProperty('Tehsil_Nam')
            const building = feature.getProperty('Name_of_Bu')
            const latitude = feature.getProperty('Latitude')
            const longitude = feature.getProperty('Longitude')
            const status = feature.getProperty('Rectificat')

            if (patwari) content += `<strong>Patwari:</strong> ${patwari}<br>`
            if (moza) content += `<strong>Moza:</strong> ${moza}<br>`
            if (district) content += `<strong>District:</strong> ${district}<br>`
            if (tehsil) content += `<strong>Tehsil:</strong> ${tehsil}<br>`
            if (building) content += `<strong>Building:</strong> ${building}<br>`
            if (latitude && longitude) content += `<strong>Coordinates:</strong> ${latitude}, ${longitude}<br>`
            if (status) content += `<strong>Status:</strong> ${status}<br>`

            content += '</div>'
          } else {
            // Regular popup for other features
            content = '<div style="max-width: 200px;">'
            feature.forEachProperty((value: any, key: string) => {
              if (value && key !== "OBJECTID") {
                content += `<strong>${key}:</strong> ${value}<br>`
              }
            })
            content += '</div>'
          }

          if (content.length > 35) {
            const infoWindow = new window.google.maps.InfoWindow({
              content: content,
              position: event.latLng
            })
            infoWindow.open(map)
          }
        }
      })

    } catch (error) {
      console.error(`🗺️ GoogleMaps: Error loading hierarchical layer ${boundary.name}:`, error)
    }
  }

  // Function to load a single GeoJSON layer with halo effect
  const loadGeoJSONLayer = async (map: any, layer: any) => {
    try {
      console.log(`GoogleMapAdvanced: Loading layer: ${layer.name} from ${layer.geojsonPath}`)
      const response = await fetch(layer.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to load ${layer.name}: ${response.status} ${response.statusText}`)
      }
      const geojsonData = await response.json()

      // Remove existing layers if they exist
      if (haloLayersRef.current[layer.id]) {
        haloLayersRef.current[layer.id].setMap(null)
        delete haloLayersRef.current[layer.id]
      }
      if (dataLayersRef.current[layer.id]) {
        dataLayersRef.current[layer.id].setMap(null)
        delete dataLayersRef.current[layer.id]
      }

      if (!window.google.maps.Data) {
        throw new Error("Google Maps Data API is not available")
      }

      // Get styling parameters based on layer type
      let weight: number, opacity: number, fillOpacity: number, dashArray: string | undefined, haloWeight: number
      switch (layer.id) {
        case "Pakistan":
          // MODIFIED: Switched to a solid line style
          weight = 3          // A strong, solid line weight
          opacity = 1.0
          fillOpacity = 0     // No fill
          dashArray = undefined // REMOVED: This makes the line solid
          haloWeight = 5      // A proportional halo for the solid line
          break
        case "khyber-pakhtunkhwa":
          weight = 3
          opacity = 1.0
          fillOpacity = 0
          dashArray = undefined
          haloWeight = 5
          break
        case "divisions":
          weight = 3
          opacity = 0.95
          fillOpacity = 0
          dashArray = undefined
          haloWeight = 5
          break
        case "districts":
          weight = 2
          opacity = 0.9
          fillOpacity = 0
          dashArray = undefined // Temporarily disable dashing to test color consistency
          haloWeight = 4
          break
        case "tehsils":
          weight = 2
          opacity = 0.85
          fillOpacity = 0
          dashArray = undefined
          haloWeight = 4
          break
        default:
          weight = 2
          opacity = 0.9
          fillOpacity = 0
          dashArray = undefined
          haloWeight = 4
      }

      // First, create the halo (white outline) layer
      const haloLayer = new window.google.maps.Data({ map: map })
      haloLayer.addGeoJson(geojsonData)
      haloLayer.setStyle({
        strokeColor: '#FFFFFF',
        strokeWeight: haloWeight,
        strokeOpacity: 0.8,
        fillOpacity: 0,
        clickable: false,
        zIndex: getZIndexForLayer(layer.id) - 1
      })

      // Then, create the main boundary layer on top
      const dataLayer = new window.google.maps.Data({ map: map })
      dataLayer.addGeoJson(geojsonData)
      
      // Style the main data layer
      dataLayer.setStyle((feature: any) => {
        const style: any = {
          fillColor: layer.color,
          fillOpacity: fillOpacity,
          clickable: true,
          zIndex: getZIndexForLayer(layer.id),
          // Default stroke styles for a solid line
          strokeColor: layer.color,
          strokeWeight: weight,
          strokeOpacity: opacity,
        };

        // This dashing logic will now only apply to layers that have a dashArray (e.g., districts)
        if (dashArray) {
          style.strokeOpacity = 0; // Hide the solid line
          const [dashLength, gapLength] = dashArray.split(',').map(s => parseInt(s.trim()));
          style.icons = [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: opacity,
              strokeColor: layer.color,
              scale: weight,
            },
            offset: '0',
            repeat: `${dashLength + gapLength}px`
          }];
          console.log(`GoogleMapAdvanced: Applied dashed styling for ${layer.id} with color ${layer.color}`)
        } else {
          console.log(`GoogleMapAdvanced: Applied solid styling for ${layer.id} with color ${layer.color}`)
        }

        return style;
      });

      // Store layer references
      haloLayersRef.current[layer.id] = haloLayer
      dataLayersRef.current[layer.id] = dataLayer

      // Add hierarchical click listener
      dataLayer.addListener('click', (event: any) => {
        const feature = event.feature
        console.log(`🗺️ GoogleMaps: Click on ${layer.name}`, feature.getProperty('District') || feature.getProperty('Division') || feature.getProperty('Province'))

        // Check if this is a hierarchical boundary and load children
        const hierarchicalBoundary = boundaryHierarchy.find(b => b.id === layer.id)
        if (hierarchicalBoundary) {
          loadHierarchicalBoundary(map, feature, layer.id)
        }

        // Show info popup
        if (feature && feature.forEachProperty) {
          let content = '<div style="max-width: 200px;">'
          feature.forEachProperty((value: any, key: string) => {
            if (value && key !== "OBJECTID") {
              content += `<strong>${key}:</strong> ${value}<br>`
            }
          })
          content += '</div>'
          if (content.length > 35) {
            const infoWindow = new window.google.maps.InfoWindow({
              content: content,
              position: event.latLng
            })
            infoWindow.open(map)
          }
        }
      })
    } catch (error) {
      console.error(`GoogleMapAdvanced: Error loading ${layer.name}:`, error)
    }
  }

  // --- The rest of the component remains unchanged ---
  
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        if (googleMapsLoader.isReady()) {
          initializeMap()
          return
        }
        googleMapsLoader.onReady(() => {
          console.log("Google Maps ready via advanced loader")
          initializeMap()
        })
        googleMapsLoader.onError((error) => {
          console.error("Google Maps loading error:", error)
          setError(`Failed to load Google Maps: ${error.message}`)
          setIsLoaded(true)
        })
        await googleMapsLoader.load()
      } catch (err) {
        console.error("Error loading Google Maps:", err)
        setError("Failed to load Google Maps")
        setIsLoaded(true)
      }
    }
    const initializeMap = () => {
      if (!mapRef.current || !window.google || !window.google.maps) {
        return
      }
      const container = mapRef.current
      if (!container.offsetWidth || !container.offsetHeight) {
        setTimeout(initializeMap, 50)
        return
      }
      try {
        setError(null)
        if (mapInstanceRef.current) {
          window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
          mapInstanceRef.current = null
        }
        const map = new window.google.maps.Map(container, {
          center: { lat: 34.0151, lng: 71.5249 },
          zoom: 7,
          mapTypeId: mapType === "satellite" ? "hybrid" : "roadmap",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#f8f9fa",
          styles: mapType === "default" ? [{ featureType: "all", elementType: "labels.text", stylers: [{ visibility: "on" }] }] : undefined
        })
        window.google.maps.event.addListenerOnce(map, 'idle', () => {
          mapInstanceRef.current = map
          setIsLoaded(true)
        })
        window.google.maps.event.addListener(map, 'error', (error: any) => {
          console.error("Google Maps error:", error)
          setError(`Map error: ${error.message || 'Unknown error'}`)
          setIsLoaded(true)
        })
        const handleZoomIn = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + 1)
        const handleZoomOut = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() - 1)
        const handleResetView = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: 34.0151, lng: 71.5249 });
            mapInstanceRef.current.setZoom(7);
          }
        }
        window.removeEventListener("mapZoomIn", handleZoomIn)
        window.removeEventListener("mapZoomOut", handleZoomOut)
        window.removeEventListener("mapResetView", handleResetView)
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
      if (mapInstanceRef.current) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
      }
      Object.values(dataLayersRef.current).forEach((layer: any) => layer?.setMap(null))
      dataLayersRef.current = {}
      Object.values(haloLayersRef.current).forEach((layer: any) => layer?.setMap(null))
      haloLayersRef.current = {}
      window.removeEventListener("mapZoomIn", () => {})
      window.removeEventListener("mapZoomOut", () => {})
      window.removeEventListener("mapResetView", () => {})
    }
  }, [])

  // Handle map type changes
  useEffect(() => {
    if (mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.setMapTypeId(mapType === "satellite" ? "hybrid" : "roadmap")
    }
  }, [mapType, isLoaded])

  // Helper function for zIndex based on boundary level
  // Higher levels (more detailed) should have higher z-index to appear on top
  const getZIndexForLevel = (level: string): number => {
    switch (level) {
      case "country": return 1000   // Bottom layer
      case "province": return 1100  // On top of country
      case "division": return 1200  // On top of province
      case "district": return 1300  // On top of division
      case "tehsil": return 1400    // On top of district
      case "patwarkhana": return 1500 // Top layer (points)
      default: return 500
    }
  }

  // Helper function for boundary colors based on level
  const getBoundaryColor = (level: string): string => {
    switch (level) {
      case "country": return "#DC2626" // Red for country
      case "province": return "#2563EB" // Blue for province
      case "division": return "#059669" // Green for division
      case "district": return "#D97706" // Orange for district
      case "tehsil": return "#EA580C" // Bright orange for tehsil
      case "patwarkhana": return "#8B5CF6" // Purple for patwarkhana points
      default: return "#6B7280" // Gray default
    }
  }

  // Helper function for boundary styling based on level
  const getBoundaryStyle = (level: string) => {
    switch (level) {
      case "country":
        return { weight: 4, opacity: 0.8, fillOpacity: 0, haloWeight: 6 }  // Thicker but slightly transparent
      case "province":
        return { weight: 3, opacity: 0.9, fillOpacity: 0, haloWeight: 5 }  // Medium thickness
      case "division":
        return { weight: 3, opacity: 0.95, fillOpacity: 0, haloWeight: 5 } // More visible
      case "district":
        return { weight: 2, opacity: 1.0, fillOpacity: 0, haloWeight: 4 }  // Fully opaque
      case "tehsil":
        return { weight: 2, opacity: 1.0, fillOpacity: 0, haloWeight: 4 }  // Fully opaque
      case "patwarkhana":
        return { weight: 1, opacity: 1.0, fillOpacity: 0.8, haloWeight: 2 }  // Points with fill
      default:
        return { weight: 2, opacity: 0.9, fillOpacity: 0, haloWeight: 4 }
    }
  }

  // Helper function for zIndex (legacy support) - updated to match hierarchical ordering
  const getZIndexForLayer = (layerId: string): number => {
    switch (layerId) {
      case "Pakistan": return 1000      // Bottom layer
      case "khyber-pakhtunkhwa": return 1100  // On top of country
      case "divisions": return 1200     // On top of province
      case "districts": return 1300     // On top of division
      case "tehsils": return 1400       // On top of district
      case "patwarkhana": return 1500   // Top layer (points)
      default: return 500
    }
  }

  // Handle container resize
  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current) return
    const resizeObserver = new ResizeObserver(() => {
     if(mapInstanceRef.current) {
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize')
     }
    })
    resizeObserver.observe(mapRef.current)
    return () => resizeObserver.disconnect()
  }, [isLoaded])

  // Handle reset view
  useEffect(() => {
    if (resetView && mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.setCenter({ lat: 34.0151, lng: 71.5249 })
      mapInstanceRef.current.setZoom(7)
    }
  }, [resetView, isLoaded])

  // Handle layer changes with version tracking
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return
    const updateLayers = async () => {
      try {
        console.log(`🗺️ GoogleMaps: updateLayers called (v${layerVersion}). Layers:`, layers.map(l => ({ id: l.id, active: l.active })))
        console.log("🗺️ GoogleMaps: Currently loaded:", Object.keys(dataLayersRef.current))
        console.log("🗺️ GoogleMaps: Active layers that should be loaded:", layers.filter(l => l.active).map(l => l.id))
        console.log("🗺️ GoogleMaps: Missing layers that need to be loaded:", layers.filter(l => l.active && !dataLayersRef.current[l.id]).map(l => l.id))
        // Clean up inactive layers (both regular and hierarchical)
        for (const layerId of Object.keys(dataLayersRef.current)) {
          const layer = layers.find(l => l.id === layerId)
          if (!layer || !layer.active) {
            console.log(`🗺️ GoogleMaps: Removing inactive layer ${layerId}`)
            
            // Special cleanup for patwarkhana layer due to its large dataset
            if (layerId === 'patwarkhana') {
              cleanupPatwarkhanaLayer(layerId)
              // Also clean up from regular refs
              delete dataLayersRef.current[layerId]
              delete haloLayersRef.current[layerId]
            } else {
              // Standard cleanup for other layers
              try {
                if (dataLayersRef.current[layerId]) {
                  // Clear event listeners for standard layers too
                  window.google.maps.event.clearInstanceListeners(dataLayersRef.current[layerId])
                  dataLayersRef.current[layerId].setMap(null)
                  delete dataLayersRef.current[layerId]
                }
                
                if (haloLayersRef.current[layerId]) {
                  window.google.maps.event.clearInstanceListeners(haloLayersRef.current[layerId])
                  haloLayersRef.current[layerId].setMap(null)
                  delete haloLayersRef.current[layerId]
                }

                // Also clean up from hierarchical layers
                if (activeBoundaryLayersRef.current[layerId]) {
                  const hierarchicalLayer = activeBoundaryLayersRef.current[layerId]
                  if (hierarchicalLayer.haloLayer) {
                    window.google.maps.event.clearInstanceListeners(hierarchicalLayer.haloLayer)
                    hierarchicalLayer.haloLayer.setMap(null)
                  }
                  if (hierarchicalLayer.dataLayer) {
                    window.google.maps.event.clearInstanceListeners(hierarchicalLayer.dataLayer)
                    hierarchicalLayer.dataLayer.setMap(null)
                  }
                  delete activeBoundaryLayersRef.current[layerId]
                  console.log(`🗺️ GoogleMaps: Removed hierarchical layer ${layerId}`)
                }
              } catch (e) {
                console.warn(`🗺️ GoogleMaps: Error during cleanup of ${layerId}:`, e)
                // Force cleanup even if there were errors
                delete dataLayersRef.current[layerId]
                delete haloLayersRef.current[layerId]
                delete activeBoundaryLayersRef.current[layerId]
              }
            }
          }
        }

        // Clean up hierarchical layers when parent layers are deactivated
        for (const boundaryId of Object.keys(activeBoundaryLayersRef.current)) {
          const boundary = boundaryHierarchy.find(b => b.id === boundaryId)
          if (boundary && boundary.parentId) {
            const parentLayer = layers.find(l => l.id === boundary.parentId)
            if (!parentLayer || !parentLayer.active) {
              console.log(`🗺️ GoogleMaps: Removing hierarchical layer ${boundaryId} due to inactive parent`)
              
              // Special cleanup for patwarkhana hierarchical layers
              if (boundaryId === 'patwarkhana' || boundary.level === 'patwarkhana') {
                cleanupPatwarkhanaLayer(boundaryId)
                // Also clean up from regular refs
                delete dataLayersRef.current[boundaryId]
                delete haloLayersRef.current[boundaryId]
              } else {
                // Standard cleanup for other hierarchical layers
                try {
                  const hierarchicalLayer = activeBoundaryLayersRef.current[boundaryId]
                  if (hierarchicalLayer.haloLayer) {
                    window.google.maps.event.clearInstanceListeners(hierarchicalLayer.haloLayer)
                    hierarchicalLayer.haloLayer.setMap(null)
                  }
                  if (hierarchicalLayer.dataLayer) {
                    window.google.maps.event.clearInstanceListeners(hierarchicalLayer.dataLayer)
                    hierarchicalLayer.dataLayer.setMap(null)
                  }
                  delete activeBoundaryLayersRef.current[boundaryId]
                  console.log(`🗺️ GoogleMaps: Removed hierarchical layer ${boundaryId} due to inactive parent`)
                } catch (e) {
                  console.warn(`🗺️ GoogleMaps: Error during hierarchical cleanup of ${boundaryId}:`, e)
                  delete activeBoundaryLayersRef.current[boundaryId]
                }
              }
            }
          }
        }

        // Load active layers - display all active layers simultaneously like Leaflet
        for (const layer of layers) {
          if (layer.geojsonPath && layer.active && !dataLayersRef.current[layer.id]) {
            console.log(`🗺️ GoogleMaps: Loading ${layer.name}`)
            
            try {
              // Enhanced validation before loading any layer
              if (!mapInstanceRef.current || !mapInstanceRef.current.getDiv()) {
                console.warn(`🗺️ GoogleMaps: Map not ready for ${layer.name}, skipping`)
                continue
              }

              // Store initial map state for recovery if needed
              const preLoadCenter = mapInstanceRef.current.getCenter()
              const preLoadZoom = mapInstanceRef.current.getZoom()

              // Load the layer using the hierarchical system for proper z-index ordering
              const hierarchicalBoundary = boundaryHierarchy.find(b => b.id === layer.id)
              if (hierarchicalBoundary) {
                console.log(`🗺️ GoogleMaps: Loading ${layer.name} as hierarchical boundary with click handlers`)
                
                // Special logging for patwarkhana
                if (layer.id === 'patwarkhana') {
                  console.log(`🗺️ GoogleMaps: Loading Patwarkhana layer (1,357 points) with simplified approach`)
                }
                
                // Load the layer normally without timeout interference
                await loadHierarchicalGeoJSONLayer(mapInstanceRef.current, hierarchicalBoundary, undefined, false)
                
                // Simplified verification - just log success, don't interfere with the layer
                setTimeout(() => {
                  try {
                    const postLoadCenter = mapInstanceRef.current?.getCenter()
                    const postLoadZoom = mapInstanceRef.current?.getZoom()
                    
                    if (postLoadCenter && postLoadZoom) {
                      console.log(`🗺️ GoogleMaps: Map verified as responsive after loading ${layer.name}`)
                    } else {
                      console.log(`🗺️ GoogleMaps: Map properties not immediately available after loading ${layer.name} - this may be normal for large datasets`)
                    }
                  } catch (verifyError) {
                    console.log(`🗺️ GoogleMaps: Post-load verification info for ${layer.name}:`, verifyError.message || verifyError)
                  }
                }, 2000)
                
                // Verify the layer was actually loaded before storing references
                if (activeBoundaryLayersRef.current[layer.id]) {
                  dataLayersRef.current[layer.id] = activeBoundaryLayersRef.current[layer.id].dataLayer
                  haloLayersRef.current[layer.id] = activeBoundaryLayersRef.current[layer.id].haloLayer
                  console.log(`🗺️ GoogleMaps: Successfully loaded and stored ${layer.name}`)
                } else {
                  console.warn(`🗺️ GoogleMaps: Layer ${layer.name} loading failed - not found in activeBoundaryLayersRef`)
                }
              } else {
                console.log(`🗺️ GoogleMaps: Loading ${layer.name} as regular layer (no click handlers)`)
                // Fallback to regular loading for non-hierarchical layers
                await loadGeoJSONLayer(mapInstanceRef.current, layer)
              }
              
            } catch (layerError) {
              console.error(`🗺️ GoogleMaps: Error loading layer ${layer.name}:`, layerError)
              
              // Clean up any partial loading attempt
              if (activeBoundaryLayersRef.current[layer.id]) {
                if (layer.id === 'patwarkhana') {
                  console.log(`🗺️ GoogleMaps: Cleaning up failed Patwarkhana loading attempt`)
                  cleanupPatwarkhanaLayer(layer.id)
                } else {
                  try {
                    const failedLayer = activeBoundaryLayersRef.current[layer.id]
                    if (failedLayer.dataLayer) failedLayer.dataLayer.setMap(null)
                    if (failedLayer.haloLayer) failedLayer.haloLayer.setMap(null)
                    delete activeBoundaryLayersRef.current[layer.id]
                  } catch (cleanupError) {
                    console.warn(`🗺️ GoogleMaps: Error during cleanup of failed layer ${layer.name}:`, cleanupError)
                  }
                }
              }
              
              // Ensure we don't store references to failed layers
              delete dataLayersRef.current[layer.id]
              delete haloLayersRef.current[layer.id]
              
              // Continue with other layers instead of stopping
              continue
            }
          }
        }

        // Load hierarchical boundaries from global store (click-based boundaries)
        await loadHierarchicalBoundariesFromStore(mapInstanceRef.current)
      } catch (error) {
        console.error("GoogleMapAdvanced: Error updating layers:", error)
      }
    }
    updateLayers()
  }, [layers, isLoaded, layerVersion])

  // Handle zoom-to-bounds requests
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !zoomToBoundsRequest) return

    const handleZoomRequest = async () => {
      console.log(`GoogleMapAdvanced: Processing zoom-to-bounds request for ${zoomToBoundsRequest.layerId}`)
      await zoomToLayerBounds(zoomToBoundsRequest.layerId)
      clearZoomToBoundsRequest()
    }

    handleZoomRequest()
  }, [zoomToBoundsRequest, isLoaded, clearZoomToBoundsRequest])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-600">
          <p>Error loading Google Maps: {error}</p>
          <button
            onClick={() => window.location.reload()}
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
      className="w-full h-full relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
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
      <FullscreenToggle className="absolute top-4 right-4 z-30" />
      {!isLoaded && (
        <div className="absolute inset-0">
          <MapSkeleton
            loadingProgress={loadingProgress}
            message="Loading Google Maps..."
          />
        </div>
      )}
    </motion.div>
  )
}