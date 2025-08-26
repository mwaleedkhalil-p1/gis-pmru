"use client"

import { create } from "zustand"

export interface MapLayer {
  id: string
  name: string
  description: string
  active: boolean
  color: string
  type: "boundary" | "point" | "polygon"
  geojsonPath?: string
  icon?: string // Lucide React icon name
}

export interface ZoomToBoundsRequest {
  layerId: string
  timestamp: number
}

export interface HierarchicalBoundaryState {
  id: string
  level: 'country' | 'province' | 'division' | 'district' | 'tehsil' | 'patwarkhana'
  parentId?: string
  parentFeature?: any // The feature that was clicked to load this boundary
  geojsonPath: string
  name: string
  active: boolean
  timestamp: number // When it was loaded
}

interface MapStore {
  layers: MapLayer[]
  mapType: "default" | "satellite"
  mapProvider: "leaflet" | "google"
  isCollapsed: boolean
  isFullscreen: boolean
  resetView: boolean
  layerVersion: number // Add version tracking for layer changes
  zoomToBoundsRequest: ZoomToBoundsRequest | null // Request to zoom to bounds of a specific layer
  hierarchicalBoundaries: HierarchicalBoundaryState[] // Track hierarchical boundaries across maps

  // Actions
  initializeLayers: () => void
  toggleLayer: (layerId: string) => void
  toggleLayerWithZoom: (layerId: string) => void // Toggle layer and zoom to bounds if activated
  setMapType: (type: "default" | "satellite") => void
  setMapProvider: (provider: "leaflet" | "google") => void
  toggleSidebar: () => void
  toggleFullscreen: () => void
  resetMapView: () => void
  getActiveLayersCount: () => number
  forceLayerUpdate: () => void // Force update for synchronization
  clearZoomToBoundsRequest: () => void // Clear the zoom request after processing

  // Hierarchical boundary actions
  addHierarchicalBoundary: (boundary: HierarchicalBoundaryState) => void
  removeHierarchicalBoundary: (boundaryId: string) => void
  clearHierarchicalBoundaries: (parentId?: string) => void // Clear all or children of a parent
  getActiveHierarchicalBoundaries: () => HierarchicalBoundaryState[]

  // Reset functionality
  resetApplication: () => void // Reset all application state and refresh page
}

export const useMapStore = create<MapStore>((set, get) => ({
  layers: [],
  mapType: "default",
  mapProvider: "leaflet",
  isCollapsed: false,
  isFullscreen: false,
  resetView: false,
  layerVersion: 0,
  zoomToBoundsRequest: null,
  hierarchicalBoundaries: [],

  initializeLayers: () => {
    try {
      set((state) => {
        // Only initialize if layers array is empty
        if (state.layers.length > 0) {
          console.log("📋 MapStore: Layers already initialized, preserving current state")
          console.log("📋 MapStore: Current layers:", state.layers.map(l => ({ id: l.id, active: l.active })))
          return state // Don't change anything
        }

        console.log("📋 MapStore: Initializing layers for the first time...")
        const initialLayers: MapLayer[] = [
          {
            id: "Pakistan",
            name: "Pakistan",
            description: "National boundaries",
            active: false,
            color: "#DC2626", // Bright Red for National Boundaries - more visible on satellite
            type: "boundary",
            geojsonPath: "/Boundaries_GeoJSON/Pak_Boundary.geojson",
          },
          {
            id: "khyber-pakhtunkhwa",
            name: "Khyber Pakhtunkhwa",
            description: "Provincial boundaries",
            active: false,
            color: "#2563EB", // Bright Blue for Provincial Boundaries - more visible on satellite
            type: "boundary",
            geojsonPath: "/Boundaries_GeoJSON/KP_Boundary.geojson",
          },

          {
            id: "divisions",
            name: "Divisions",
            description: "Administrative divisions",
            active: false,
            color: "#7C2D12", // Dark Brown for Division Boundaries - enhanced contrast
            type: "boundary",
            geojsonPath: "/Boundaries_GeoJSON/KP_Divisions.geojson",
          },
          {
            id: "districts",
            name: "Districts",
            description: "District-level administrative boundaries",
            active: false,
            color: "#16A34A", // Bright Green for District Boundaries - more visible on satellite
            type: "boundary",
            geojsonPath: "/Boundaries_GeoJSON/KP_Districts.geojson",
          },
          {
            id: "tehsils",
            name: "Tehsils",
            description: "Sub-district administrative boundaries",
            active: false,
            color: "#EA580C", // Bright Orange for Tehsil Boundaries - more visible on satellite
            type: "boundary",
            geojsonPath: "/Boundaries_GeoJSON/KP_Tehsils.geojson",
          },
          {
            id: "patwarkhana",
            name: "Patwarkhana Coordinates",
            description: "Land record office locations and coordinates",
            active: false,
            color: "#8B5CF6", // Purple for Patwarkhana points - distinct from boundaries
            type: "point",
            geojsonPath: "/Boundaries_GeoJSON/Patwarkhana_Coordinates_GeoJson.geojson",
            icon: "PatwarKhana",
          },
        ]

        console.log("📋 MapStore: Setting initial layers:", initialLayers.map(l => ({ id: l.id, active: l.active })))
        console.log("📋 MapStore: Layers initialized successfully")
        return { ...state, layers: initialLayers }
      })
    } catch (error) {
      console.error("Error initializing layers:", error)
    }
  },

  toggleLayer: (layerId: string) => {
    try {
      set((state) => {
        const newLayers = state.layers.map((layer) => (layer.id === layerId ? { ...layer, active: !layer.active } : layer))
        const newVersion = state.layerVersion + 1
        console.log(`🔄 MapStore: Toggled ${layerId}. New state:`, newLayers.find(l => l.id === layerId)?.active)
        console.log(`🔄 MapStore: Version updated to:`, newVersion)
        console.log("🔄 MapStore: All layers after toggle:", newLayers.map(l => ({ id: l.id, active: l.active })))
        return { layers: newLayers, layerVersion: newVersion }
      })
    } catch (error) {
      console.error("Error toggling layer:", error)
    }
  },

  setMapType: (type: "default" | "satellite") => {
    try {
      set({ mapType: type })
    } catch (error) {
      console.error("Error setting map type:", error)
    }
  },

  setMapProvider: (provider: "leaflet" | "google") => {
    try {
      set((state) => {
        const newVersion = state.layerVersion + 1
        console.log(`🔄 MapStore: Switching to ${provider}. Current layers:`, state.layers.map(l => ({ id: l.id, active: l.active })))
        console.log(`🔄 MapStore: Forcing layer update with version:`, newVersion)
        return { mapProvider: provider, layerVersion: newVersion }
      })
    } catch (error) {
      console.error("Error setting map provider:", error)
    }
  },

  toggleSidebar: () => {
    try {
      set((state) => ({ isCollapsed: !state.isCollapsed }))
    } catch (error) {
      console.error("Error toggling sidebar:", error)
    }
  },

  toggleFullscreen: () => {
    try {
      set((state) => ({ isFullscreen: !state.isFullscreen }))
    } catch (error) {
      console.error("Error toggling fullscreen:", error)
    }
  },

  resetMapView: () => {
    try {
      set({ resetView: true })
      setTimeout(() => set({ resetView: false }), 100)
    } catch (error) {
      console.error("Error resetting map view:", error)
    }
  },

  getActiveLayersCount: () => {
    try {
      return get().layers.filter((layer) => layer.active).length
    } catch (error) {
      console.error("Error getting active layers count:", error)
      return 0
    }
  },

  forceLayerUpdate: () => {
    try {
      set((state) => ({
        layerVersion: state.layerVersion + 1
      }))
    } catch (error) {
      console.error("Error forcing layer update:", error)
    }
  },

  toggleLayerWithZoom: (layerId: string) => {
    try {
      set((state) => {
        const newLayers = state.layers.map((layer) => (layer.id === layerId ? { ...layer, active: !layer.active } : layer))
        const toggledLayer = newLayers.find(l => l.id === layerId)
        const newVersion = state.layerVersion + 1

        console.log(`🔄 MapStore: Toggled ${layerId} with zoom. New state:`, toggledLayer?.active)
        console.log(`🔄 MapStore: Version updated to:`, newVersion)

        // If layer was just activated, create zoom request
        let zoomRequest = state.zoomToBoundsRequest
        if (toggledLayer?.active && toggledLayer.geojsonPath) {
          zoomRequest = {
            layerId: layerId,
            timestamp: Date.now()
          }
          console.log(`🔄 MapStore: Created zoom-to-bounds request for ${layerId}`)
        }

        return {
          layers: newLayers,
          layerVersion: newVersion,
          zoomToBoundsRequest: zoomRequest
        }
      })
    } catch (error) {
      console.error("Error toggling layer with zoom:", error)
    }
  },

  clearZoomToBoundsRequest: () => {
    try {
      set({ zoomToBoundsRequest: null })
    } catch (error) {
      console.error("Error clearing zoom to bounds request:", error)
    }
  },

  // Hierarchical boundary management
  addHierarchicalBoundary: (boundary: HierarchicalBoundaryState) => {
    try {
      set((state) => {
        // Remove existing boundary with same ID if it exists
        const filteredBoundaries = state.hierarchicalBoundaries.filter(b => b.id !== boundary.id)
        const newBoundaries = [...filteredBoundaries, boundary]
        const newVersion = state.layerVersion + 1

        console.log(`🔄 MapStore: Added hierarchical boundary ${boundary.id} (${boundary.name})`)
        console.log(`🔄 MapStore: Active hierarchical boundaries:`, newBoundaries.filter(b => b.active).map(b => b.name))

        return {
          hierarchicalBoundaries: newBoundaries,
          layerVersion: newVersion
        }
      })
    } catch (error) {
      console.error("Error adding hierarchical boundary:", error)
    }
  },

  removeHierarchicalBoundary: (boundaryId: string) => {
    try {
      set((state) => {
        const newBoundaries = state.hierarchicalBoundaries.filter(b => b.id !== boundaryId)
        const newVersion = state.layerVersion + 1

        console.log(`🔄 MapStore: Removed hierarchical boundary ${boundaryId}`)

        return {
          hierarchicalBoundaries: newBoundaries,
          layerVersion: newVersion
        }
      })
    } catch (error) {
      console.error("Error removing hierarchical boundary:", error)
    }
  },

  clearHierarchicalBoundaries: (parentId?: string) => {
    try {
      set((state) => {
        let newBoundaries = state.hierarchicalBoundaries

        if (parentId) {
          // Clear only children of the specified parent
          newBoundaries = state.hierarchicalBoundaries.filter(b => b.parentId !== parentId)
          console.log(`🔄 MapStore: Cleared hierarchical boundaries for parent ${parentId}`)
        } else {
          // Clear all hierarchical boundaries
          newBoundaries = []
          console.log(`🔄 MapStore: Cleared all hierarchical boundaries`)
        }

        const newVersion = state.layerVersion + 1

        return {
          hierarchicalBoundaries: newBoundaries,
          layerVersion: newVersion
        }
      })
    } catch (error) {
      console.error("Error clearing hierarchical boundaries:", error)
    }
  },

  getActiveHierarchicalBoundaries: () => {
    try {
      return get().hierarchicalBoundaries.filter(b => b.active)
    } catch (error) {
      console.error("Error getting active hierarchical boundaries:", error)
      return []
    }
  },

  resetApplication: () => {
    try {
      console.log("🔄 MapStore: Resetting application state...")

      // Reset all state to initial values
      set({
        layers: [],
        mapType: "default",
        mapProvider: "leaflet",
        isCollapsed: false,
        isFullscreen: false,
        resetView: false,
        layerVersion: 0,
        zoomToBoundsRequest: null,
        hierarchicalBoundaries: []
      })

      console.log("🔄 MapStore: Application state reset complete")

      // Refresh the page to ensure complete reset
      setTimeout(() => {
        console.log("🔄 MapStore: Refreshing page...")
        window.location.reload()
      }, 100)

    } catch (error) {
      console.error("Error resetting application:", error)
      // Fallback: just refresh the page
      window.location.reload()
    }
  },
}))
