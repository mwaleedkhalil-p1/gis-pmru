import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// GeoJSON types for bounds calculation
export interface GeoJSONBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface LatLngBounds {
  lat: number
  lng: number
}

/**
 * Calculate the bounding box from GeoJSON data
 * Supports both FeatureCollection and individual Feature objects
 * Returns bounds in a format compatible with both Google Maps and Leaflet
 */
export function calculateGeoJSONBounds(geojsonData: any): GeoJSONBounds | null {
  if (!geojsonData) {
    console.warn("calculateGeoJSONBounds: No GeoJSON data provided")
    return null
  }

  console.log("calculateGeoJSONBounds: Processing GeoJSON data:", {
    type: geojsonData.type,
    featuresCount: geojsonData.features?.length || 0,
    hasCoordinates: !!geojsonData.coordinates
  })

  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity

  const processCoordinates = (coordinates: any) => {
    if (!Array.isArray(coordinates)) return

    // Handle different geometry types
    const flattenCoordinates = (coords: any): number[][] => {
      if (coords.length === 0) return []

      // Check if this is a coordinate pair [lng, lat]
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [coords]
      }

      // Recursively flatten nested arrays
      const result: number[][] = []
      for (const coord of coords) {
        result.push(...flattenCoordinates(coord))
      }
      return result
    }

    const flatCoords = flattenCoordinates(coordinates)

    for (const coord of flatCoords) {
      if (coord.length >= 2) {
        const [lng, lat] = coord
        if (typeof lng === 'number' && typeof lat === 'number') {
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
        }
      }
    }
  }

  const processGeometry = (geometry: any) => {
    if (!geometry || !geometry.coordinates) return
    processCoordinates(geometry.coordinates)
  }

  const processFeature = (feature: any) => {
    if (!feature) return

    if (feature.geometry) {
      processGeometry(feature.geometry)
    }
  }

  try {
    // Handle FeatureCollection
    if (geojsonData.type === 'FeatureCollection' && geojsonData.features) {
      for (const feature of geojsonData.features) {
        processFeature(feature)
      }
    }
    // Handle individual Feature
    else if (geojsonData.type === 'Feature') {
      processFeature(geojsonData)
    }
    // Handle Geometry directly
    else if (geojsonData.coordinates) {
      processGeometry(geojsonData)
    }
    else {
      console.warn("calculateGeoJSONBounds: Unrecognized GeoJSON structure", geojsonData)
      return null
    }

    // Check if we found valid bounds
    if (minLat === Infinity || maxLat === -Infinity || minLng === Infinity || maxLng === -Infinity) {
      console.warn("calculateGeoJSONBounds: No valid coordinates found in GeoJSON data")
      return null
    }

    const bounds = {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    }

    console.log("calculateGeoJSONBounds: Calculated bounds:", bounds)
    return bounds
  } catch (error) {
    console.error("calculateGeoJSONBounds: Error processing GeoJSON data", error)
    return null
  }
}

/**
 * Convert GeoJSONBounds to Google Maps LatLngBounds format
 */
export function toGoogleMapsBounds(bounds: GeoJSONBounds): { north: number; south: number; east: number; west: number } {
  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west
  }
}

/**
 * Convert GeoJSONBounds to Leaflet bounds format [[south, west], [north, east]]
 */
export function toLeafletBounds(bounds: GeoJSONBounds): [[number, number], [number, number]] {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
  ]
}
