"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useMapStore } from "@/context/mapStore"

export function Header() {
  const { resetApplication } = useMapStore()

  const handleLogoClick = () => {
    console.log("🏠 Header: Logo clicked - resetting application")
    resetApplication()
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r bg-[#54befcc9] shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center justify-center px-6 py-4">
        {/* Logo - Clickable to reset */}
        <div className="flex items-center space-x-4 absolute left-6">
          <button
            onClick={handleLogoClick}
            className="relative w-18 h-24 rounded-full bg-white/10 backdrop-blur-sm p-2 hover:bg-white/20 hover:shadow-lg transition-all duration-200 cursor-pointer group active:scale-95"
            title="Click to refresh and reset the application"
          >
            <Image
              src="/images/pmru-logo.png"
              alt="PMRU Logo - Click to reset"
              width={32}
              height={32}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
            />
            {/* Subtle reset icon overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-1 right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Centered Title */}
        <div className="text-center text-white">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-2xl md:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-white via-blue-50 to-white bg-clip-text text-transparent drop-shadow-lg"
          >
           GIS Governance for different Activities across Departments and Districts
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-sm md:text-base text-blue-50 opacity-95 font-medium tracking-wide mt-1 drop-shadow-sm"
          >
            {/* OFFICE OF THE CHIEF SECRETARY GOVERNMENT OF KHYBER PAKHTUNKHWA  */}
          </motion.p>
        </div>
      </div>
    </motion.header>
  )
}
