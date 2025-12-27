'use client';

import { usePathname } from 'next/navigation';
import FallingLeaves from './FallingLeaves';

export default function ConditionalLeaves() {
  const pathname = usePathname();
  
  // Don't show global leaves on the landing page (it has its own)
  if (pathname === '/') {
    return null;
  }
  
  return <FallingLeaves />;
}
