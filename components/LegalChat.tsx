'use client';

import { useState } from 'react';
import { Chat } from './Chat';

interface LegalChatProps {
  userId: string;
}

export default function LegalChat({ userId }: LegalChatProps) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Legal Knowledge Chat</h2>
        <p className="text-gray-600 text-sm">
          Ask questions about Indian legal statutes including IPC, BNS, BSA, and CrPC. 
          The system has access to comprehensive legal knowledge base.
        </p>
      </div>
      
      {/* Use existing Chat component */}
      <Chat />
    </div>
  );
}