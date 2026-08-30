'use client';

import React from 'react';
import { MunchTableStage } from '@/components/table/MunchTableStage';

export default function MunchTablePage() {
  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col">
      <MunchTableStage />
    </div>
  );
}
