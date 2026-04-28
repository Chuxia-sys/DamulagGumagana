'use client';

import React from 'react';
import Image from 'next/image';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t bg-gradient-to-b from-background to-muted/30">
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="container mx-auto px-4 lg:px-6">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between py-6 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-sm" />
              <Image
                src="/logo.png"
                alt="FEPC Logo"
                width={28}
                height={28}
                className="relative rounded-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">FEPC</span>
              <span className="text-[10px] text-muted-foreground tracking-wide">
                Far Eastern Polytechnic College
              </span>
            </div>
          </div>

          {/* Center Tagline */}
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1 w-1 rounded-full bg-primary/40" />
            <span>Intelligent Scheduling System</span>
            <div className="h-1 w-1 rounded-full bg-primary/40" />
          </div>

          {/* Copyright */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>© {currentYear}</span>
            <span className="hidden sm:inline">FEPC.</span>
            <span className="hidden sm:inline">All rights reserved.</span>
            <span className="sm:hidden">All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
