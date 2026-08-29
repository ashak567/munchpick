'use client'

import React from 'react'
import { motion } from 'framer-motion'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex-1 flex flex-col min-h-0 h-full overflow-hidden"
    >
      {children}
    </motion.div>
  )
}
