"use client"

// Performance monitoring for Google Maps loading
class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private startTime: number | null = null
  private metrics: { [key: string]: number } = {}

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  startTiming(label: string): void {
    this.startTime = performance.now()
    this.metrics[`${label}_start`] = this.startTime
    console.log(`⏱️ Started timing: ${label}`)
  }

  endTiming(label: string): number {
    if (!this.startTime) {
      console.warn(`No start time found for ${label}`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - this.startTime
    this.metrics[`${label}_end`] = endTime
    this.metrics[`${label}_duration`] = duration

    console.log(`✅ ${label} completed in ${duration.toFixed(2)}ms`)
    
    // Log performance insights
    if (duration < 1000) {
      console.log(`🚀 Excellent performance for ${label}`)
    } else if (duration < 3000) {
      console.log(`⚡ Good performance for ${label}`)
    } else {
      console.log(`⚠️ Slow performance for ${label} - consider optimization`)
    }

    return duration
  }

  markMilestone(label: string): void {
    const time = performance.now()
    this.metrics[label] = time
    console.log(`📍 Milestone: ${label} at ${time.toFixed(2)}ms`)
  }

  getMetrics(): { [key: string]: number } {
    return { ...this.metrics }
  }

  logSummary(): void {
    console.group("📊 Performance Summary")
    Object.entries(this.metrics).forEach(([key, value]) => {
      if (key.endsWith('_duration')) {
        const label = key.replace('_duration', '')
        console.log(`${label}: ${value.toFixed(2)}ms`)
      }
    })
    console.groupEnd()
  }

  reset(): void {
    this.startTime = null
    this.metrics = {}
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Auto-start monitoring when module loads
if (typeof window !== 'undefined') {
  performanceMonitor.markMilestone('app_start')
}
