"use client"

import { useEffect, useRef, useState } from "react"
import { useMapStore } from "@/context/mapStore"
import { FullscreenToggle } from "@/components/FullscreenToggle"
import { calculateGeoJSONBounds, toLeafletBounds } from "@/lib/utils"

export default function SimpleMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const layerGroupsRef = useRef<Record<string, any>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    mapType,
    layers,
    isFullscreen,
    layerVersion,
    zoomToBoundsRequest,
    clearZoomToBoundsRequest,
    hierarchicalBoundaries,
    addHierarchicalBoundary,
    removeHierarchicalBoundary,
    clearHierarchicalBoundaries
  } = useMapStore()

  console.log("🍃 Leaflet: Component rendered. Layers:", layers.map(l => ({ id: l.id, active: l.active })))
  console.log("🍃 Leaflet: Active layers count:", layers.filter(l => l.active).length)
  console.log("🍃 Leaflet: Hierarchical boundaries from store:", hierarchicalBoundaries.map(b => ({ id: b.id, active: b.active, parentId: b.parentId })))

  // Define hierarchical boundary structure (same as Google Maps)
  const boundaryHierarchy = [
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
  const getChildBoundaries = (parentId: string) => {
    return boundaryHierarchy.filter(boundary => boundary.parentId === parentId)
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
    console.log(`SimpleMap: zoomToLayerBounds called for ${layerId}`)

    if (!mapInstanceRef.current) {
      console.warn("SimpleMap: Cannot zoom to bounds - map not initialized")
      return
    }

    const layer = layers.find(l => l.id === layerId)
    if (!layer || !layer.geojsonPath) {
      console.warn(`SimpleMap: Cannot zoom to bounds - layer ${layerId} not found or has no geojsonPath`)
      console.log("SimpleMap: Available layers:", layers.map(l => ({ id: l.id, geojsonPath: l.geojsonPath })))
      return
    }

    try {
      console.log(`SimpleMap: Fetching GeoJSON for bounds calculation: ${layer.geojsonPath}`)
      const response = await fetch(layer.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${layer.name}: ${response.status} ${response.statusText}`)
      }

      const geojsonData = await response.json()
      const bounds = calculateGeoJSONBounds(geojsonData)

      if (!bounds) {
        console.warn(`SimpleMap: Could not calculate bounds for layer ${layerId}`)
        return
      }

      const leafletBounds = toLeafletBounds(bounds)
      console.log(`SimpleMap: Zooming to bounds for ${layer.name}:`, leafletBounds)

      // Validate bounds to prevent infinite tiles error
      if (!leafletBounds || !Array.isArray(leafletBounds) || leafletBounds.length !== 2) {
        console.warn(`SimpleMap: Invalid bounds for ${layerId}:`, leafletBounds)
        return
      }

      const [[southWest], [northEast]] = leafletBounds
      if (!Array.isArray(southWest) || !Array.isArray(northEast) ||
          southWest.length !== 2 || northEast.length !== 2) {
        console.warn(`SimpleMap: Invalid bounds format for ${layerId}:`, leafletBounds)
        return
      }

      const [swLat, swLng] = southWest
      const [neLat, neLng] = northEast

      // Check for valid coordinate ranges
      if (swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90 ||
          swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180) {
        console.warn(`SimpleMap: Coordinates out of valid range for ${layerId}:`, { swLat, swLng, neLat, neLng })
        return
      }

      // Check for reasonable bounds size (not too small to cause infinite zoom)
      const latDiff = Math.abs(neLat - swLat)
      const lngDiff = Math.abs(neLng - swLng)

      if (latDiff < 0.001 && lngDiff < 0.001) {
        console.warn(`SimpleMap: Bounds too small for ${layerId}, using default zoom instead`)
        // For very small bounds (like single points), just center the map
        mapInstanceRef.current.setView([(swLat + neLat) / 2, (swLng + neLng) / 2], 10)
        return
      }

      // Apply different zoom strategies based on layer type
      let padding = [50, 50]
      let maxZoom = undefined

      switch (layerId) {
        case "patwarkhana":
          // For Patwarkhana points, use conservative zoom to prevent infinite tiles
          padding = [100, 100]
          maxZoom = 8  // Conservative max zoom for point data
          console.log(`SimpleMap: Using conservative zoom settings for Patwarkhana points`)
          break
        case "districts":
          // For districts, use smaller padding and moderate zoom
          padding = [20, 20]
          maxZoom = 10
          break
        case "tehsils":
          // For tehsils, use very small padding and much higher zoom for very close view
          padding = [10, 10]
          maxZoom = 13
          break
        case "divisions":
          // For divisions, moderate padding and zoom
          padding = [30, 30]
          maxZoom = 8
          break
        default:
          // Default for provinces and country level
          padding = [50, 50]
      }

      // Use Leaflet fitBounds with custom padding
      const fitBoundsOptions: any = { padding }
      if (maxZoom) {
        fitBoundsOptions.maxZoom = maxZoom
      }

      console.log(`SimpleMap: Applying fitBounds with options:`, fitBoundsOptions)
      mapInstanceRef.current.fitBounds(leafletBounds, fitBoundsOptions)

    } catch (error) {
      console.error(`SimpleMap: Error zooming to bounds for ${layerId}:`, error)
    }
  }





  // Function to load hierarchical boundaries from global store
  const loadHierarchicalBoundariesFromStore = async (map: any, L: any) => {
    try {
      console.log(`🍃 Leaflet: Loading hierarchical boundaries from store`)
      console.log(`🍃 Leaflet: Total hierarchical boundaries in store:`, hierarchicalBoundaries.length)
      const activeHierarchicalBoundaries = hierarchicalBoundaries.filter(b => b.active)
      console.log(`🍃 Leaflet: Active hierarchical boundaries:`, activeHierarchicalBoundaries.map(b => ({ id: b.id, name: b.name, parentId: b.parentId })))

      if (activeHierarchicalBoundaries.length === 0) {
        console.log(`🍃 Leaflet: No active hierarchical boundaries to load`)
        return
      }

      for (const boundaryState of activeHierarchicalBoundaries) {
        // Skip if already loaded
        if (layerGroupsRef.current[boundaryState.id]) {
          console.log(`🍃 Leaflet: Hierarchical boundary ${boundaryState.id} already loaded`)
          continue
        }

        // Find the boundary definition
        const boundaryDef = boundaryHierarchy.find(b => b.id === boundaryState.id)
        if (!boundaryDef) {
          console.warn(`🍃 Leaflet: Boundary definition not found for ${boundaryState.id}`)
          continue
        }

        console.log(`🍃 Leaflet: Loading hierarchical boundary from store: ${boundaryState.name}`)
        console.log(`🍃 Leaflet: Parent feature data:`, boundaryState.parentFeature)

        // Create a layer object for loading
        const layerObj = {
          id: boundaryState.id,
          name: boundaryState.name,
          geojsonPath: boundaryState.geojsonPath,
          color: getBoundaryColor(boundaryState.level),
          type: "boundary" as const
        }

        // Load with filtering if we have parent feature data
        const shouldFilter = !!boundaryState.parentFeature
        await loadHierarchicalGeoJSONLayer(map, L, layerObj, boundaryState.parentFeature, shouldFilter, boundaryState.level)
      }
    } catch (error) {
      console.error(`🍃 Leaflet: Error loading hierarchical boundaries from store:`, error)
    }
  }

  // Simple fallback function for Patwarkhana loading when map isn't ready for advanced features
  const loadPatwarkhanaSimple = async (map: any, L: any, layer: any, geojsonData: any) => {
    try {
      console.log(`🍃 Leaflet: Loading Patwarkhana with simple approach (${geojsonData.features.length} points)`)

      // Create layer group
      const layerGroup = L.layerGroup()

      // Create custom icon for Patwarkhana
      const patwarKhanaIcon = L.divIcon({
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: #1E88E5;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          ">
            <svg width="28" height="28" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g fill="white">
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
          </div>
        `,
        className: 'patwar-khana-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      })

      // Use standard GeoJSON loading with performance optimizations
      const geoJsonLayer = L.geoJSON(geojsonData, {
        pointToLayer: (feature: any, latlng: any) => {
          return L.marker(latlng, { icon: patwarKhanaIcon })
        },
        onEachFeature: (feature: any, featureLayer: any) => {
          // Add popup with Patwarkhana information
          const props = feature.properties
          const popupContent = `
            <div style="max-width: 250px;">
              <h4 style="margin: 0 0 8px 0; color: #8B5CF6;">Patwarkhana Information</h4>
              ${props.Name_of_Pa ? `<strong>Patwari:</strong> ${props.Name_of_Pa}<br>` : ''}
              ${props.Name_of_Mo ? `<strong>Moza:</strong> ${props.Name_of_Mo}<br>` : ''}
              ${props.District_N ? `<strong>District:</strong> ${props.District_N}<br>` : ''}
              ${props.Tehsil_Nam ? `<strong>Tehsil:</strong> ${props.Tehsil_Nam}<br>` : ''}
              ${props.Name_of_Bu ? `<strong>Building:</strong> ${props.Name_of_Bu}<br>` : ''}
              ${props.Latitude && props.Longitude ? `<strong>Coordinates:</strong> ${props.Latitude}, ${props.Longitude}<br>` : ''}
              ${props.Rectificat ? `<strong>Status:</strong> ${props.Rectificat}<br>` : ''}
            </div>
          `
          featureLayer.bindPopup(popupContent)
        }
      })

      layerGroup.addLayer(geoJsonLayer)

      // Add to map with safety checks
      if (map && map.getContainer && map.getContainer()) {
        layerGroup.addTo(map)
        layerGroupsRef.current[layer.id] = layerGroup
      } else {
        console.error(`🍃 Leaflet: Map container not ready for ${layer.id}`)
        throw new Error("Map container not initialized")
      }

      console.log(`🍃 Leaflet: Successfully loaded ${geojsonData.features.length} Patwarkhana points (simple mode)`)

    } catch (error) {
      console.error(`🍃 Leaflet: Error loading Patwarkhana layer (simple):`, error)
      throw error
    }
  }

  // High-performance function to load Patwarkhana points with viewport-based rendering
  const loadPatwarkhanaLayer = async (map: any, L: any, layer: any, geojsonData: any) => {
    try {
      console.log(`🍃 Leaflet: Loading Patwarkhana with high-performance optimization (${geojsonData.features.length} points)`)

      // Enhanced safety checks for map and Leaflet library
      if (!map || !L) {
        console.error(`🍃 Leaflet: Invalid map or L object for Patwarkhana`)
        throw new Error("Map or Leaflet library not available for Patwarkhana")
      }

      // Check if map container is ready
      if (!map.getContainer || !map.getContainer()) {
        console.error(`🍃 Leaflet: Map container not ready for Patwarkhana`)
        throw new Error("Map container not initialized for Patwarkhana")
      }

      // Remove existing layer if it exists with error handling
      if (layerGroupsRef.current[layer.id]) {
        try {
          map.removeLayer(layerGroupsRef.current[layer.id])
        } catch (e) {
          console.warn(`🍃 Leaflet: Error removing existing Patwarkhana layer:`, e)
        }
        delete layerGroupsRef.current[layer.id]
      }

      // Check if map is ready for advanced rendering with enhanced validation
      const canUseViewportRendering = map && 
                                      map.getBounds && 
                                      map.getContainer() && 
                                      typeof map.getBounds === 'function' &&
                                      L.circleMarker &&
                                      L.layerGroup

      if (!canUseViewportRendering) {
        console.log(`🍃 Leaflet: Map not ready for viewport rendering, using simple approach`)
        return await loadPatwarkhanaSimple(map, L, layer, geojsonData)
      }

      // Additional verification - try to get bounds to ensure map is fully ready
      try {
        const testBounds = map.getBounds()
        if (!testBounds) {
          throw new Error("Map bounds not available")
        }
      } catch (e) {
        console.log(`🍃 Leaflet: Map bounds test failed, using simple approach:`, e)
        return await loadPatwarkhanaSimple(map, L, layer, geojsonData)
      }

      // Store the full dataset for viewport-based rendering
      const patwarkhanaData = geojsonData.features
      const activeMarkers: any[] = []

      // Create custom icon for Patwarkhana
      const patwarKhanaIcon = L.divIcon({
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: #1E88E5;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          ">
            <svg width="28" height="28" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g fill="white">
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
          </div>
        `,
        className: 'patwar-khana-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      })

      // Create layer group for managing markers
      const layerGroup = L.layerGroup()

      // Function to render only visible markers (viewport-based rendering)
      const renderVisibleMarkers = () => {
        if (!map || !map.getBounds || !map.getContainer()) return

        // Additional safety check for map initialization
        try {
          // Check if map is fully initialized by testing getBounds
          const bounds = map.getBounds()
          const currentZoom = map.getZoom()

          // Validate bounds before proceeding
          if (!bounds || !bounds.isValid || !bounds.isValid()) {
            console.log(`🍃 Leaflet: Map bounds not ready yet, skipping render`)
            return
          }

        // Clear existing markers
        activeMarkers.forEach(marker => layerGroup.removeLayer(marker))
        activeMarkers.length = 0

        // Performance optimization: limit markers based on zoom level
        let maxMarkers = 1500 // Show all at high zoom
        if (currentZoom < 8) maxMarkers = 500   // Fewer markers when zoomed out
        if (currentZoom < 6) maxMarkers = 200   // Even fewer when very zoomed out

        let markersAdded = 0

        // Add markers that are within bounds and under the limit
        patwarkhanaData.forEach((feature: any) => {
          if (markersAdded >= maxMarkers) return

          if (feature.geometry && feature.geometry.coordinates) {
            const [lng, lat] = feature.geometry.coordinates
            const latlng = L.latLng(lat, lng)

            // Check if marker is within current viewport
            if (bounds.contains(latlng)) {
              // Use custom Patwar Khana icon
              const marker = L.marker(latlng, {
                icon: patwarKhanaIcon,
                // Performance optimization: disable some interactions at low zoom
                interactive: currentZoom > 7
              })

              // Add popup only if interactive (performance optimization)
              if (currentZoom > 7) {
                const props = feature.properties
                const popupContent = `
                  <div style="max-width: 250px;">
                    <h4 style="margin: 0 0 8px 0; color: #8B5CF6;">Patwarkhana Information</h4>
                    ${props.Name_of_Pa ? `<strong>Patwari:</strong> ${props.Name_of_Pa}<br>` : ''}
                    ${props.Name_of_Mo ? `<strong>Moza:</strong> ${props.Name_of_Mo}<br>` : ''}
                    ${props.District_N ? `<strong>District:</strong> ${props.District_N}<br>` : ''}
                    ${props.Tehsil_Nam ? `<strong>Tehsil:</strong> ${props.Tehsil_Nam}<br>` : ''}
                    ${props.Name_of_Bu ? `<strong>Building:</strong> ${props.Name_of_Bu}<br>` : ''}
                    ${props.Latitude && props.Longitude ? `<strong>Coordinates:</strong> ${props.Latitude}, ${props.Longitude}<br>` : ''}
                    ${props.Rectificat ? `<strong>Status:</strong> ${props.Rectificat}<br>` : ''}
                  </div>
                `
                marker.bindPopup(popupContent)
              }

              layerGroup.addLayer(marker)
              activeMarkers.push(marker)
              markersAdded++
            }
          }
        })

        console.log(`🍃 Leaflet: Rendered ${markersAdded} Patwarkhana markers in viewport (zoom: ${currentZoom})`)

        } catch (error) {
          console.warn(`🍃 Leaflet: Error rendering Patwarkhana markers:`, error)
          // Fallback: try again after a short delay
          setTimeout(() => {
            try {
              renderVisibleMarkers()
            } catch (retryError) {
              console.error(`🍃 Leaflet: Failed to render Patwarkhana markers after retry:`, retryError)
            }
          }, 500)
        }
      }

      // Delay initial render to ensure map is fully initialized
      const initialRender = () => {
        // Wait for map to be ready
        if (map && map.getBounds && map.getContainer()) {
          try {
            // Test if map is ready by calling getBounds
            map.getBounds()
            renderVisibleMarkers()
          } catch (error) {
            console.log(`🍃 Leaflet: Map not ready for initial render, retrying...`)
            setTimeout(initialRender, 200)
          }
        } else {
          setTimeout(initialRender, 200)
        }
      }

      // Start initial render with delay
      setTimeout(initialRender, 100)

      // Re-render when map moves or zooms (with debouncing for performance)
      let renderTimeout: NodeJS.Timeout
      const debouncedRender = () => {
        clearTimeout(renderTimeout)
        renderTimeout = setTimeout(() => {
          try {
            renderVisibleMarkers()
          } catch (error) {
            console.warn(`🍃 Leaflet: Error in debounced render:`, error)
          }
        }, 100) // 100ms debounce
      }

      map.on('moveend', debouncedRender)
      map.on('zoomend', debouncedRender)

      // Store cleanup function
      const cleanup = () => {
        map.off('moveend', debouncedRender)
        map.off('zoomend', debouncedRender)
        clearTimeout(renderTimeout)
      }

      // Add to map and store reference with safety checks
      if (map && map.getContainer && map.getContainer()) {
        layerGroup.addTo(map)
        layerGroupsRef.current[layer.id] = layerGroup

        // Store cleanup function for later use
        layerGroupsRef.current[layer.id]._patwarkhanaCleanup = cleanup
      } else {
        console.error(`🍃 Leaflet: Map container not ready for ${layer.id}`)
        throw new Error("Map container not initialized")
      }

      console.log(`🍃 Leaflet: Successfully initialized viewport-based rendering for ${geojsonData.features.length} Patwarkhana points`)

    } catch (error) {
      console.error(`🍃 Leaflet: Error loading Patwarkhana layer:`, error)
      throw error
    }
  }

  // Function to load a hierarchical GeoJSON layer with optional filtering
  const loadHierarchicalGeoJSONLayer = async (map: any, L: any, layer: any, parentFeature?: any, shouldFilter: boolean = true, level?: string) => {
    try {
      console.log(`🍃 Leaflet: Loading hierarchical layer: ${layer.name} from ${layer.geojsonPath}`)

      // Enhanced safety checks
      if (!map || !L) {
        console.error(`🍃 Leaflet: Invalid map or L object for ${layer.name}`)
        throw new Error("Map or Leaflet library not available")
      }

      // Check if map container is ready and still exists
      if (!map.getContainer || !map.getContainer()) {
        console.error(`🍃 Leaflet: Map container not ready for ${layer.name}`)
        throw new Error("Map container not initialized")
      }

      // Check if Leaflet library is properly loaded
      if (!L.geoJSON || !L.layerGroup) {
        console.error(`🍃 Leaflet: Leaflet methods not available for ${layer.name}`)
        throw new Error("Leaflet methods not available")
      }

      const response = await fetch(layer.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to load ${layer.name}: ${response.statusText}`)
      }

      const geojsonData = await response.json()

      // Special handling for Patwarkhana (point data) - use optimized loading
      if (level === 'patwarkhana' || layer.id === 'patwarkhana') {
        return await loadPatwarkhanaLayer(map, L, layer, geojsonData)
      }

      // Filter features only if we have a parent feature AND shouldFilter is true (for click-based loading)
      let filteredGeoJsonData = geojsonData
      if (parentFeature && shouldFilter && level && level !== 'country' && level !== 'province') {
        const filteredFeatures = geojsonData.features.filter((feature: any) =>
          isFeatureInClickedArea(feature, parentFeature, level)
        )

        filteredGeoJsonData = {
          ...geojsonData,
          features: filteredFeatures
        }

        console.log(`🍃 Leaflet: Filtered ${geojsonData.features.length} features to ${filteredFeatures.length} for ${layer.name}`)
      } else {
        console.log(`🍃 Leaflet: Loading all features for ${layer.name} (${geojsonData.features.length} features)`)
      }

      // Remove existing layer if it exists
      if (layerGroupsRef.current[layer.id]) {
        try {
          map.removeLayer(layerGroupsRef.current[layer.id])
        } catch (e) {
          console.warn(`🍃 Leaflet: Error removing existing layer ${layer.id}:`, e)
        }
        delete layerGroupsRef.current[layer.id]
      }

      // Create layer group for this layer - with safety checks
      let layerGroup
      try {
        layerGroup = L.layerGroup()
      } catch (e) {
        console.error(`🍃 Leaflet: Error creating layer group for ${layer.name}:`, e)
        throw e
      }

      // Get styling parameters based on boundary level
      const { weight, opacity, fillOpacity, haloWeight } = getBoundaryStyle(level || 'default')

      // Create halo layer (white outline) - with enhanced error handling
      let haloLayer
      try {
        haloLayer = L.geoJSON(filteredGeoJsonData, {
          style: {
            color: '#FFFFFF',
            weight: haloWeight,
            opacity: 0.8,
            fillOpacity: 0,
            interactive: false
          }
        })
      } catch (e) {
        console.error(`🍃 Leaflet: Error creating halo layer for ${layer.name}:`, e)
        throw e
      }

      // Create main layer with hierarchical click support - with enhanced error handling
      let mainLayer
      try {
        mainLayer = L.geoJSON(filteredGeoJsonData, {
          style: {
            color: layer.color,
            weight: weight,
            opacity: opacity,
            fillColor: layer.color,
            fillOpacity: fillOpacity,
          },
          pointToLayer: (feature: any, latlng: any) => {
            // Special handling for point features (Patwarkhana)
            if (level === 'patwarkhana') {
              // Create custom icon for Patwarkhana
              const patwarKhanaIcon = L.divIcon({
                html: `
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: #1E88E5;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                  ">
                    <svg width="28" height="28" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g fill="white">
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
                  </div>
                `,
                className: 'patwar-khana-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
                popupAnchor: [0, -20]
              })
              return L.marker(latlng, { icon: patwarKhanaIcon })
            }
            return L.marker(latlng) // Default marker for other points
          },
          onEachFeature: (feature: any, featureLayer: any) => {
            // Add popup with feature information
            if (feature.properties) {
              let popupContent = ""

              if (level === 'patwarkhana') {
                // Special popup for Patwarkhana with relevant fields
                const props = feature.properties
                popupContent = `
                  <div style="max-width: 250px;">
                    <h4 style="margin: 0 0 8px 0; color: #8B5CF6;">Patwarkhana Information</h4>
                    ${props.Name_of_Pa ? `<strong>Patwari:</strong> ${props.Name_of_Pa}<br>` : ''}
                    ${props.Name_of_Mo ? `<strong>Moza:</strong> ${props.Name_of_Mo}<br>` : ''}
                    ${props.District_N ? `<strong>District:</strong> ${props.District_N}<br>` : ''}
                    ${props.Tehsil_Nam ? `<strong>Tehsil:</strong> ${props.Tehsil_Nam}<br>` : ''}
                    ${props.Name_of_Bu ? `<strong>Building:</strong> ${props.Name_of_Bu}<br>` : ''}
                    ${props.Latitude && props.Longitude ? `<strong>Coordinates:</strong> ${props.Latitude}, ${props.Longitude}<br>` : ''}
                    ${props.Rectificat ? `<strong>Status:</strong> ${props.Rectificat}<br>` : ''}
                  </div>
                `
              } else {
                // Regular popup for other features
                popupContent = Object.entries(feature.properties)
                  .filter(([key, value]) => value && key !== "OBJECTID")
                  .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                  .join("<br>")

                if (popupContent) {
                  popupContent = `<div style="max-width: 200px;">${popupContent}</div>`
                }
              }

              if (popupContent) {
                featureLayer.bindPopup(popupContent)
              }
            }

            // Add hierarchical click listener
            featureLayer.on('click', (e: any) => {
              console.log(`🍃 Leaflet: Hierarchical click on ${layer.name}`, feature.properties.District || feature.properties.Division || feature.properties.Province)
              console.log(`🍃 Leaflet: Click event triggered for layer ${layer.id}`)

              // Load child boundaries for this feature
              loadHierarchicalBoundary(map, L, feature, layer.id)
            })
          }
        })
      } catch (e) {
        console.error(`🍃 Leaflet: Error creating main layer for ${layer.name}:`, e)
        throw e
      }

      // Add both layers to the layer group (halo first, then main layer on top) - with error handling
      try {
        layerGroup.addLayer(haloLayer)
        layerGroup.addLayer(mainLayer)
      } catch (e) {
        console.error(`🍃 Leaflet: Error adding layers to layer group for ${layer.name}:`, e)
        throw e
      }

      // Add to map with enhanced safety checks and verification
      try {
        // Double-check map state before adding
        if (!map || !map.getContainer || !map.getContainer()) {
          throw new Error("Map container not ready")
        }

        // Verify the layer group is valid before adding
        if (!layerGroup || typeof layerGroup.addTo !== 'function') {
          throw new Error("Layer group is invalid")
        }

        layerGroup.addTo(map)
        
        // Verify the layer was successfully added
        if (!map.hasLayer(layerGroup)) {
          throw new Error("Layer failed to be added to map")
        }

        // Store layer reference only after successful addition
        layerGroupsRef.current[layer.id] = layerGroup
        console.log(`🍃 Leaflet: Successfully added ${layer.name} to map`)
        
      } catch (e) {
        console.error(`🍃 Leaflet: Error adding layer group to map for ${layer.name}:`, e)
        
        // Clean up failed layer group
        try {
          if (layerGroup) {
            layerGroup.clearLayers()
          }
        } catch (cleanupError) {
          console.warn(`🍃 Leaflet: Error during cleanup for ${layer.name}:`, cleanupError)
        }
        
        throw new Error(`Map container not initialized or layer addition failed: ${e.message}`)
      }

    } catch (error) {
      console.error(`🍃 Leaflet: Error loading hierarchical layer ${layer.name}:`, error)
    }
  }

  // Function to load hierarchical boundary when a boundary is clicked
  const loadHierarchicalBoundary = async (map: any, L: any, clickedFeature: any, clickedBoundaryId: string) => {
    try {
      console.log(`🍃 Leaflet: Loading hierarchical boundary for ${clickedBoundaryId}`)

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
        layerGroupsRef.current[child.id]
      )

      if (hasLoadedChildren) {
        console.log(`🍃 Leaflet: Clearing existing child boundaries for ${clickedBoundaryId}`)
        clearChildBoundaries(map, clickedBoundaryId)
        return
      }

      // Load each child boundary
      for (const childBoundary of childBoundaries) {
        console.log(`🍃 Leaflet: Loading child boundary: ${childBoundary.name}`)

        // Create layer object
        const layerObj = {
          id: childBoundary.id,
          name: childBoundary.name,
          geojsonPath: childBoundary.geojsonPath,
          color: getBoundaryColor(childBoundary.level),
          type: "boundary" as const
        }

        // Load the child boundary with filtering (since this is click-based)
        await loadHierarchicalGeoJSONLayer(map, L, layerObj, clickedFeature, true, childBoundary.level)

        // Add to global store for synchronization
        console.log(`🍃 Leaflet: Adding hierarchical boundary to store:`, {
          id: childBoundary.id,
          parentId: clickedBoundaryId,
          parentFeature: clickedFeature.properties
        })

        addHierarchicalBoundary({
          id: childBoundary.id,
          level: childBoundary.level as any,
          parentId: clickedBoundaryId,
          parentFeature: clickedFeature.properties,
          geojsonPath: childBoundary.geojsonPath,
          name: childBoundary.name,
          active: true,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error(`🍃 Leaflet: Error loading hierarchical boundary:`, error)
    }
  }

  // Function to clear child boundaries recursively
  const clearChildBoundaries = (map: any, parentId: string) => {
    const childBoundaries = getChildBoundaries(parentId)

    for (const childBoundary of childBoundaries) {
      // Remove the child boundary if it exists
      if (layerGroupsRef.current[childBoundary.id]) {
        map.removeLayer(layerGroupsRef.current[childBoundary.id])
        delete layerGroupsRef.current[childBoundary.id]
        console.log(`🍃 Leaflet: Cleared child boundary: ${childBoundary.name}`)
      }

      // Remove from global store
      removeHierarchicalBoundary(childBoundary.id)

      // Recursively clear grandchildren
      clearChildBoundaries(map, childBoundary.id)
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

  // Function to load a single GeoJSON layer
  const loadGeoJSONLayer = async (map: any, L: any, layer: any) => {
    try {
      const response = await fetch(layer.geojsonPath)
      if (!response.ok) {
        throw new Error(`Failed to load ${layer.name}: ${response.statusText}`)
      }

      const geojsonData = await response.json()

      // Remove existing layer if it exists
      if (layerGroupsRef.current[layer.id]) {
        map.removeLayer(layerGroupsRef.current[layer.id])
      }

      // Create layer group with halo effect for satellite view visibility
      const layerGroup = L.layerGroup()

      // First, create the halo (white outline) layer for better visibility on satellite
      const haloLayer = L.geoJSON(geojsonData, {
        style: () => {
          let haloWeight

          switch (layer.id) {
            case "Pakistan":
              haloWeight = 6 // Wider halo for national boundaries
              break
            case "khyber-pakhtunkhwa":
              haloWeight = 5 // Wide halo for provincial boundaries
              break
            case "divisions":
              haloWeight = 5 // Wide halo for division boundaries
              break
            case "districts":
              haloWeight = 4 // Medium halo for district boundaries
              break
            case "tehsils":
              haloWeight = 4 // Medium halo for tehsil boundaries
              break
            default:
              haloWeight = 4
          }

          return {
            color: '#FFFFFF', // White halo
            weight: haloWeight,
            opacity: 0.8,
            fillOpacity: 0,
            dashArray: undefined // No dashes for halo
          }
        }
      })

      // Then, create the main boundary layer on top
      const mainLayer = L.geoJSON(geojsonData, {
        style: () => {
          // Define enhanced styling for satellite view visibility
          let weight, opacity, fillOpacity, dashArray

          switch (layer.id) {
            case "Pakistan":
              // National Boundaries: Bold (4px), High opacity, Dashed lines
              weight = 4
              opacity = 1.0
              fillOpacity = 0 // No fill
              dashArray = "12, 6" // Dashed pattern for national boundaries
              break
            case "khyber-pakhtunkhwa":
              // Provincial Boundaries: Bold (3px), High opacity
              weight = 3
              opacity = 1.0
              fillOpacity = 0 // No fill
              dashArray = undefined
              break
            case "divisions":
              // Division Boundaries: Medium-Bold (3px), High opacity
              weight = 3
              opacity = 0.95
              fillOpacity = 0 // No fill
              dashArray = undefined
              break
            case "districts":
              // District Boundaries: Medium (2px), High opacity, Slightly dashed for clarity
              weight = 2
              opacity = 0.9
              fillOpacity = 0 // No fill
              dashArray = undefined // Temporarily disable dashing to test color consistency
              break
            case "tehsils":
              // Tehsil/Subdistrict Boundaries: Light-Medium (2px), Good opacity
              weight = 2
              opacity = 0.85
              fillOpacity = 0 // No fill
              dashArray = undefined
              break
            default:
              weight = 2
              opacity = 0.9
              fillOpacity = 0 // No fill
              dashArray = undefined
          }

          const style = {
            color: layer.color,
            weight: weight,
            opacity: opacity,
            fillColor: layer.color,
            fillOpacity: fillOpacity,
            dashArray: dashArray
          }

          console.log(`SimpleMap: Applied styling for ${layer.id} with color ${layer.color}, weight: ${weight}, opacity: ${opacity}, dashArray: ${dashArray}`)
          return style
        },
        onEachFeature: (feature: any, featureLayer: any) => {
          // Add popup with feature information
          if (feature.properties) {
            const popupContent = Object.entries(feature.properties)
              .filter(([key, value]) => value && key !== "OBJECTID")
              .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
              .join("<br>")

            if (popupContent) {
              featureLayer.bindPopup(`<div style="max-width: 200px;">${popupContent}</div>`)
            }
          }
        }
      })

      // Add both layers to the layer group (halo first, then main layer on top)
      layerGroup.addLayer(haloLayer)
      layerGroup.addLayer(mainLayer)

      // Add to map with safety checks
      if (map && map.getContainer && map.getContainer()) {
        layerGroup.addTo(map)
        // Store layer reference only after successful addition
        layerGroupsRef.current[layer.id] = layerGroup
      } else {
        console.error(`🍃 Leaflet: Map container not ready for ${layer.id}`)
        throw new Error("Map container not initialized")
      }

    } catch (error) {
      console.error(`Error loading ${layer.name}:`, error)
    }
  }

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return

      try {
        setError(null)
        console.log("🍃 Leaflet: Initializing map with layers:", layers.map(l => ({ id: l.id, active: l.active })))

        // Minimal DOM ready wait
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Load Leaflet from CDN if not available
        if (typeof window !== "undefined" && !(window as any).L) {
          const script = document.createElement("script")
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          script.crossOrigin = ""
          script.onload = () => {
            initializeMap()
          }
          script.onerror = () => {
            setError("Failed to load Leaflet library")
            setIsLoaded(true)
          }
          document.head.appendChild(script)
        } else {
          initializeMap()
        }

        function initializeMap() {
          try {
            const L = (window as any).L
            if (!L || !mapRef.current) {
              setError("Leaflet library not available")
              setIsLoaded(true)
              return
            }

            // Remove existing map if any
            if (mapInstanceRef.current) {
              try {
                mapInstanceRef.current.remove()
              } catch (e) {
                console.warn("Error removing existing map:", e)
              }
            }

            // Create map with performance optimizations
            const map = L.map(mapRef.current, {
              center: [34.0151, 71.5249],
              zoom: 7,
              zoomControl: false,
              attributionControl: false,
              preferCanvas: true,
              renderer: L.canvas(),
              fadeAnimation: false,
              zoomAnimation: true,
              markerZoomAnimation: false,
            })

            mapInstanceRef.current = map

            // Add English-only tile layer with performance optimizations
            if (mapType === "satellite") {
              // Add Esri World Imagery (satellite)
              const satelliteLayer = L.tileLayer(
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                {
                  attribution: "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
                  maxZoom: 18,
                  keepBuffer: 2,
                  updateWhenZooming: false,
                  updateWhenIdle: true,
                  errorTileUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                }
              )

              // Add English-only labels layer on top of satellite
              const labelsLayer = L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
                {
                  attribution: "&copy; CARTO",
                  subdomains: ["a", "b", "c", "d"],
                  maxZoom: 18,
                  keepBuffer: 2,
                  updateWhenZooming: false,
                  updateWhenIdle: true,
                  pane: 'overlayPane',
                  errorTileUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                }
              )

              satelliteLayer.addTo(map)
              labelsLayer.addTo(map)
            } else {
              // Use CartoDB Positron for clean English-only street map
              const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
                attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
                subdomains: ["a", "b", "c", "d"],
                maxZoom: 18,
                keepBuffer: 2,
                updateWhenZooming: false,
                updateWhenIdle: true,
                errorTileUrl:
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
              })

              tileLayer.addTo(map)
            }

            // Store map reference first
            mapInstanceRef.current = map
            setIsLoaded(true)

            console.log("🍃 Leaflet: Map initialized, triggering layer load for:", layers.filter(l => l.active).map(l => l.name))
            // Map is ready - the useEffect will handle layer loading

            // Add event listeners with error handling
            const handleZoomIn = () => {
              try {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.zoomIn()
                }
              } catch (e) {
                console.error("Zoom in error:", e)
              }
            }

            const handleZoomOut = () => {
              try {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.zoomOut()
                }
              } catch (e) {
                console.error("Zoom out error:", e)
              }
            }

            const handleResetView = () => {
              try {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([34.0151, 71.5249], 7)
                }
              } catch (e) {
                console.error("Reset view error:", e)
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
            setError("Failed to initialize map")
            setIsLoaded(true)
          }
        }
      } catch (err) {
        console.error("Map setup error:", err)
        setError("Failed to setup map")
        setIsLoaded(true)
      }
    }

    initMap()

    return () => {
      try {
        // Clean up event listeners
        window.removeEventListener("mapZoomIn", () => {})
        window.removeEventListener("mapZoomOut", () => {})
        window.removeEventListener("mapResetView", () => {})

        // Clean up map instance
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove()
          } catch (e) {
            console.warn("Error cleaning up map:", e)
          }
          mapInstanceRef.current = null
        }

        // Clear layer references only after map cleanup
        layerGroupsRef.current = {}
      } catch (e) {
        console.warn("Cleanup error:", e)
      }
    }
  }, [])

  // Handle map type changes without recreating the map
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    const updateMapType = async () => {
      try {
        const L = (window as any).L
        if (!L) return

        // Remove existing tile layers
        mapInstanceRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.TileLayer) {
            mapInstanceRef.current.removeLayer(layer)
          }
        })

        // Add new English-only tile layers based on map type
        if (mapType === "satellite") {
          // Add Esri World Imagery (satellite)
          const satelliteLayer = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              attribution: "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
              maxZoom: 18,
              keepBuffer: 2,
              updateWhenZooming: false,
              updateWhenIdle: true,
            }
          )

          // Add English-only labels layer on top of satellite
          const labelsLayer = L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
            {
              attribution: "&copy; CARTO",
              subdomains: ["a", "b", "c", "d"],
              maxZoom: 18,
              keepBuffer: 2,
              updateWhenZooming: false,
              updateWhenIdle: true,
              pane: 'overlayPane',
            }
          )

          satelliteLayer.addTo(mapInstanceRef.current)
          labelsLayer.addTo(mapInstanceRef.current)
        } else {
          // Use CartoDB Positron for clean English-only street map
          const tileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            subdomains: ["a", "b", "c", "d"],
            maxZoom: 18,
            keepBuffer: 2,
            updateWhenZooming: false,
            updateWhenIdle: true,
          })

          tileLayer.addTo(mapInstanceRef.current)
        }
      } catch (error) {
        console.error("Error updating map type:", error)
      }
    }

    updateMapType()
  }, [mapType, isLoaded])

  // Handle layer changes with version tracking
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    const L = (window as any).L
    if (!L) return

    // Additional safety check for map container
    if (!mapInstanceRef.current.getContainer || !mapInstanceRef.current.getContainer()) {
      console.warn("🍃 Leaflet: Map container not ready, skipping layer update")
      return
    }

    const updateLayers = async () => {
      try {
        console.log(`🍃 Leaflet: updateLayers called (v${layerVersion}). Layers:`, layers.map(l => ({ id: l.id, active: l.active })))
        console.log("🍃 Leaflet: Currently loaded:", Object.keys(layerGroupsRef.current))
        console.log("🍃 Leaflet: Active layers that should be loaded:", layers.filter(l => l.active).map(l => l.id))
        console.log("🍃 Leaflet: Missing layers that need to be loaded:", layers.filter(l => l.active && !layerGroupsRef.current[l.id]).map(l => l.id))

        // First, remove any layers that should not be active
        for (const layerId of Object.keys(layerGroupsRef.current)) {
          const layer = layers.find(l => l.id === layerId)
          if (!layer || !layer.active) {
            console.log(`🍃 Leaflet: Removing ${layerId} (no longer active)`)
            try {
              // Special cleanup for Patwarkhana layer (viewport-based rendering)
              if (layerId === 'patwarkhana' && layerGroupsRef.current[layerId]._patwarkhanaCleanup) {
                layerGroupsRef.current[layerId]._patwarkhanaCleanup()
                console.log(`🍃 Leaflet: Cleaned up Patwarkhana event listeners`)
              }

              mapInstanceRef.current.removeLayer(layerGroupsRef.current[layerId])
              delete layerGroupsRef.current[layerId]
            } catch (e) {
              console.warn(`🍃 Leaflet: Error removing layer ${layerId}:`, e)
              delete layerGroupsRef.current[layerId] // Remove reference anyway
            }
          }
        }

        // Clean up hierarchical boundaries when parent layers are deactivated
        const activeHierarchicalBoundaries = hierarchicalBoundaries.filter(b => b.active)
        for (const boundary of activeHierarchicalBoundaries) {
          if (boundary.parentId) {
            const parentLayer = layers.find(l => l.id === boundary.parentId)
            if (!parentLayer || !parentLayer.active) {
              // Remove the hierarchical boundary layer
              if (layerGroupsRef.current[boundary.id]) {
                mapInstanceRef.current.removeLayer(layerGroupsRef.current[boundary.id])
                delete layerGroupsRef.current[boundary.id]
                console.log(`🍃 Leaflet: Removed hierarchical layer ${boundary.id} due to inactive parent`)
              }
              // Remove from global store
              removeHierarchicalBoundary(boundary.id)
            }
          }
        }

        // Then, add any layers that should be active
        for (const layer of layers) {
          if (layer.geojsonPath && layer.active) {
            if (!layerGroupsRef.current[layer.id]) {
              console.log(`🍃 Leaflet: Loading ${layer.name}`)

              // Enhanced safety checks before loading layer
              if (!mapInstanceRef.current || !mapInstanceRef.current.getContainer || !mapInstanceRef.current.getContainer()) {
                console.warn(`🍃 Leaflet: Map container not ready for ${layer.name}, skipping`)
                continue
              }

              if (!L || !L.geoJSON || !L.layerGroup) {
                console.warn(`🍃 Leaflet: Leaflet library not ready for ${layer.name}, skipping`)
                continue
              }

              try {
                // Check if this is a hierarchical boundary
                const hierarchicalBoundary = boundaryHierarchy.find(b => b.id === layer.id)
                if (hierarchicalBoundary) {
                  console.log(`🍃 Leaflet: Loading ${layer.name} as hierarchical boundary with click handlers`)
                  // Load using hierarchical system for proper styling and click handling
                  await loadHierarchicalGeoJSONLayer(mapInstanceRef.current, L, layer, undefined, false, hierarchicalBoundary.level)
                } else {
                  console.log(`🍃 Leaflet: Loading ${layer.name} as regular layer (no click handlers)`)
                  // Load regular layer
                  await loadGeoJSONLayer(mapInstanceRef.current, L, layer)
                }
              } catch (layerError) {
                console.error(`🍃 Leaflet: Failed to load layer ${layer.name}:`, layerError)
                // Continue with other layers instead of breaking the entire process
                continue
              }
            } else {
              console.log(`🍃 Leaflet: ${layer.name} already loaded`)
            }
          }
        }

        // Load hierarchical boundaries from global store (click-based boundaries)
        await loadHierarchicalBoundariesFromStore(mapInstanceRef.current, L)

        console.log(`🍃 Leaflet: Layer update complete (v${layerVersion}). Active layers:`, Object.keys(layerGroupsRef.current))
      } catch (error) {
        console.error("Error updating layers:", error)
      }
    }

    updateLayers()
  }, [layers, isLoaded, layerVersion])

  // Handle zoom-to-bounds requests
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !zoomToBoundsRequest) return

    const handleZoomRequest = async () => {
      console.log(`SimpleMap: Processing zoom-to-bounds request for ${zoomToBoundsRequest.layerId}`)
      await zoomToLayerBounds(zoomToBoundsRequest.layerId)
      clearZoomToBoundsRequest()
    }

    handleZoomRequest()
  }, [zoomToBoundsRequest, isLoaded, clearZoomToBoundsRequest])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-600">
          <p>Error loading map: {error}</p>
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
    <div className="w-full h-full relative z-10">
      <div
        ref={mapRef}
        className="w-full h-full relative z-10"
        style={{
          minHeight: "400px",
          background: "#f0f0f0",
        }}
      />

      {/* Fullscreen Toggle Button */}
      <FullscreenToggle className="absolute top-4 right-4 z-30" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p>Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}
