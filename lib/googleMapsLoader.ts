"use client"

import { performanceMonitor } from "./performanceMonitor"

// Advanced Google Maps Loader with caching and preloading
class GoogleMapsLoader {
  private static instance: GoogleMapsLoader
  private loadPromise: Promise<void> | null = null
  private isLoaded = false
  private isLoading = false
  private callbacks: (() => void)[] = []
  private errorCallbacks: ((error: Error) => void)[] = []

  private constructor() {}

  static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader()
    }
    return GoogleMapsLoader.instance
  }

  // Preload Google Maps script immediately when the service is created
  preload(): Promise<void> {
    performanceMonitor.markMilestone('gmaps_preload_start')

    if (this.isLoaded) {
      performanceMonitor.markMilestone('gmaps_preload_already_loaded')
      return Promise.resolve()
    }

    if (this.loadPromise) {
      performanceMonitor.markMilestone('gmaps_preload_existing_promise')
      return this.loadPromise
    }

    performanceMonitor.startTiming('gmaps_preload')
    this.loadPromise = this.loadScript()
    return this.loadPromise
  }

  // Load Google Maps and return a promise
  load(): Promise<void> {
    performanceMonitor.markMilestone('gmaps_load_start')

    if (this.isLoaded) {
      performanceMonitor.markMilestone('gmaps_load_already_loaded')
      return Promise.resolve()
    }

    if (this.loadPromise) {
      performanceMonitor.markMilestone('gmaps_load_existing_promise')
      return this.loadPromise
    }

    performanceMonitor.startTiming('gmaps_load')
    this.loadPromise = this.loadScript()
    return this.loadPromise
  }

  // Check if Google Maps is ready
  isReady(): boolean {
    return this.isLoaded && window.google && window.google.maps
  }

  // Add callback for when maps is ready
  onReady(callback: () => void): void {
    if (this.isReady()) {
      callback()
    } else {
      this.callbacks.push(callback)
    }
  }

  // Add error callback
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }

  private async loadScript(): Promise<void> {
    if (this.isLoading) {
      return this.loadPromise!
    }

    this.isLoading = true

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.maps) {
        this.isLoaded = true
        this.isLoading = false
        this.notifyCallbacks()
        resolve()
        return
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="mapsJavaScriptAPI.js"]')
      if (existingScript) {
        this.waitForGoogleMaps(resolve, reject)
        return
      }

      // Create and load script
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/gh/somanchiu/Keyless-Google-Maps-API@v7.0/mapsJavaScriptAPI.js"
      script.async = true
      script.defer = true

      // Set up global initMap function
      window.initMap = () => {
        console.log("Google Maps loaded via global initMap")
        this.waitForGoogleMaps(resolve, reject)
      }

      script.onload = () => {
        console.log("Google Maps script loaded")
        this.waitForGoogleMaps(resolve, reject)
      }

      script.onerror = () => {
        const error = new Error("Failed to load Google Maps script")
        this.isLoading = false
        this.notifyErrorCallbacks(error)
        reject(error)
      }

      // Add script to head with high priority
      document.head.insertBefore(script, document.head.firstChild)
    })
  }

  private waitForGoogleMaps(resolve: () => void, reject: (error: Error) => void): void {
    let attempts = 0
    const maxAttempts = 50
    const checkInterval = 150 // Reduced interval for faster checking

    const checkGoogleMaps = () => {
      attempts++

      if (window.google && 
          window.google.maps && 
          window.google.maps.Map && 
          window.google.maps.event) {
        
        this.isLoaded = true
        this.isLoading = false
        this.notifyCallbacks()
        resolve()
      } else if (attempts < maxAttempts) {
        setTimeout(checkGoogleMaps, checkInterval)
      } else {
        const error = new Error("Google Maps failed to initialize after multiple attempts")
        this.isLoading = false
        this.notifyErrorCallbacks(error)
        reject(error)
      }
    }

    checkGoogleMaps()
  }

  private notifyCallbacks(): void {
    performanceMonitor.endTiming('gmaps_load')
    performanceMonitor.markMilestone('gmaps_ready')
    performanceMonitor.logSummary()

    this.callbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error("Error in Google Maps ready callback:", error)
      }
    })
    this.callbacks = []
  }

  private notifyErrorCallbacks(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error)
      } catch (callbackError) {
        console.error("Error in Google Maps error callback:", callbackError)
      }
    })
    this.errorCallbacks = []
  }

  // Clean up resources
  cleanup(): void {
    this.callbacks = []
    this.errorCallbacks = []
    if (window.initMap) {
      window.initMap = undefined as any
    }
  }
}

// Export singleton instance
export const googleMapsLoader = GoogleMapsLoader.getInstance()

// Auto-preload when module is imported (advanced loading)
if (typeof window !== 'undefined') {
  // Preload after a short delay to not block initial page load
  setTimeout(() => {
    googleMapsLoader.preload().catch(error => {
      console.warn("Google Maps preload failed:", error)
    })
  }, 100)
}
