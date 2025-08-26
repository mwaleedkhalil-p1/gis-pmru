"use client"

import { motion } from "framer-motion"

interface MapSkeletonProps {
  loadingProgress?: number
  message?: string
}

export function MapSkeleton({ loadingProgress = 0, message = "Loading map..." }: MapSkeletonProps) {
  return (
    <div className="w-full h-full relative bg-gradient-to-br from-blue-50 to-gray-100 overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full">
          {/* Grid pattern */}
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      {/* Animated map elements */}
      <div className="absolute inset-0">
        {/* Simulated roads */}
        <motion.div
          className="absolute top-1/4 left-0 w-full h-1 bg-gray-300 rounded"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/4 w-1/2 h-1 bg-gray-300 rounded"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, delay: 1 }}
        />
        <motion.div
          className="absolute top-3/4 left-1/8 w-3/4 h-1 bg-gray-300 rounded"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.8, delay: 1.2 }}
        />

        {/* Simulated landmarks */}
        <motion.div
          className="absolute top-1/3 left-1/3 w-4 h-4 bg-blue-400 rounded-full"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        />
        <motion.div
          className="absolute top-2/3 left-2/3 w-3 h-3 bg-green-400 rounded-full"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.8 }}
        />
        <motion.div
          className="absolute top-1/2 left-3/4 w-2 h-2 bg-red-400 rounded-full"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 2 }}
        />

        {/* Simulated areas */}
        <motion.div
          className="absolute top-1/4 right-1/4 w-20 h-16 bg-green-200 rounded-lg opacity-60"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 0.8, delay: 2.2 }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/4 w-16 h-12 bg-blue-200 rounded-lg opacity-60"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.6 }}
          transition={{ duration: 0.8, delay: 2.5 }}
        />
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="text-center space-y-6 max-w-sm mx-auto p-6">
          {/* Main loading spinner */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse" />
            </div>
          </div>

          {/* Loading text */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">
              {message}
            </h3>
            <p className="text-sm text-gray-600">
              Preparing your interactive map experience
            </p>
          </div>

          {/* Progress bar */}
          {loadingProgress > 0 && (
            <div className="space-y-2">
              <div className="w-64 bg-gray-200 rounded-full h-3 mx-auto overflow-hidden">
                <motion.div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full shadow-sm" 
                  initial={{ width: 0 }}
                  animate={{ width: `${loadingProgress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {loadingProgress}% complete
              </p>
            </div>
          )}

          {/* Loading steps */}
          <div className="space-y-1 text-xs text-gray-500">
            <motion.div
              className={`flex items-center space-x-2 ${loadingProgress >= 20 ? 'text-green-600' : ''}`}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: loadingProgress >= 20 ? 1 : 0.5 }}
            >
              <div className={`w-2 h-2 rounded-full ${loadingProgress >= 20 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Loading map engine...</span>
            </motion.div>
            <motion.div
              className={`flex items-center space-x-2 ${loadingProgress >= 60 ? 'text-green-600' : ''}`}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: loadingProgress >= 60 ? 1 : 0.5 }}
            >
              <div className={`w-2 h-2 rounded-full ${loadingProgress >= 60 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Initializing map services...</span>
            </motion.div>
            <motion.div
              className={`flex items-center space-x-2 ${loadingProgress >= 90 ? 'text-green-600' : ''}`}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: loadingProgress >= 90 ? 1 : 0.5 }}
            >
              <div className={`w-2 h-2 rounded-full ${loadingProgress >= 90 ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>Rendering map...</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
