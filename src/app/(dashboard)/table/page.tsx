'use client';

import React from 'react';
import { MunchTableStage } from '@/components/table/MunchTableStage';

export default function MunchTablePage() {
  return (
    <div className="relative w-full h-full flex-1 flex flex-col min-h-0 overflow-hidden">
      <MunchTableStage />
    </div>
  );
}
