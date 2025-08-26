import React from 'react'

interface PatwarKhanaIconProps {
  className?: string
  size?: number
}

export const PatwarKhanaIcon: React.FC<PatwarKhanaIconProps> = ({ 
  className = "", 
  size = 16 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 375 375" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <metadata><ContainsAiGeneratedContent>Yes</ContainsAiGeneratedContent></metadata>
      <defs>
        <filter x="0%" y="0%" width="100%" height="100%" id="107d4ac6a3">
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" colorInterpolationFilters="sRGB"/>
        </filter>
        <filter x="0%" y="0%" width="100%" height="100%" id="ab4f5b56a7">
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.2126 0.7152 0.0722 0 0" colorInterpolationFilters="sRGB"/>
        </filter>
        <clipPath id="0491e2294a">
          <path d="M 0 0 L 371.820312 0 L 371.820312 375 L 0 375 Z M 0 0 " clipRule="nonzero"/>
        </clipPath>
        <mask id="819b467e07">
          <g filter="url(#107d4ac6a3)">
            <g filter="url(#ab4f5b56a7)" transform="matrix(0.366211, 0, 0, 0.366211, -3.180725, 0)">
              <rect x="0" y="0" width="1024" height="1024" fill="url(#imagePattern)" />
            </g>
          </g>
        </mask>
        <clipPath id="1039618a36">
          <path d="M 41.8125 41.542969 L 326.8125 41.542969 L 326.8125 333.292969 L 41.8125 333.292969 Z M 41.8125 41.542969 " clipRule="nonzero"/>
        </clipPath>
        <mask id="e5749fb917">
          <g filter="url(#107d4ac6a3)">
            <g filter="url(#ab4f5b56a7)" transform="matrix(0.356689, 0, 0, 0.356689, -1.582056, 5.051455)">
              <rect x="0" y="0" width="1024" height="1024" fill="#4A90E2" />
            </g>
          </g>
        </mask>
      </defs>
      <g clipPath="url(#0491e2294a)">
        <rect x="0" y="0" width="375" height="375" fill="#4A90E2"/>
        <g mask="url(#819b467e07)">
          <rect x="0" y="0" width="375" height="375" fill="currentColor"/>
        </g>
      </g>
      <g clipPath="url(#1039618a36)">
        <rect x="41.8125" y="41.542969" width="285" height="291.75" fill="white" fillOpacity="0.9"/>
        <g mask="url(#e5749fb917)">
          <rect x="41.8125" y="41.542969" width="285" height="291.75" fill="currentColor"/>
        </g>
      </g>
    </svg>
  )
}
