import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import React from 'react';

interface NavbarProps {
  title?: string;
  badges?: React.ReactNode[];
  showBackButton?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function Navbar({ title = 'ARC Puzzle Interface', badges, showBackButton = false, onBack, children }: NavbarProps) {
  return (
    <header className="bg-slate-900 border-b-2 border-amber-500 shadow-lg sticky top-0 z-20">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Title */}
          <div className="flex items-center gap-8">
            {showBackButton && onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                className="border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-slate-900 text-lg"
              >
                &larr; Back
              </Button>
            )}
            <div className="flex items-center gap-4">
              <Link href="/">
                <a className="text-3xl font-bold text-amber-400 hover:text-amber-300 transition-colors">
                  {title}
                </a>
              </Link>
              {badges && badges.length > 0 && (
                <div className="flex items-center gap-2">
                  {badges.map((badge, index) => (
                    <React.Fragment key={index}>{badge}</React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-8">
            {children ? children :
              <div className="hidden md:flex md:items-center md:space-x-8">
                <a
                  href="https://github.com/neoneye/ARC-Interactive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-medium text-slate-300 hover:text-amber-400 transition-colors"
                >
                  Powered by neoneye's ARC-Interactive
                </a>
                <a
                  href="https://github.com/neoneye/ARC-Interactive-History-Dataset"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-medium text-slate-300 hover:text-amber-400 transition-colors"
                >
                  Using ARC History Dataset
                </a>
              </div>
            }
          </div>
        </div>
      </div>
    </header>
  );
}