import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/Navbar';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { EmojiPaletteDivider } from '@/components/officer/EmojiPaletteDivider';
import type { EmojiSet } from '@/constants/spaceEmojis';
import type { DisplayMode } from '@/types/puzzleDisplayTypes';

export function ComponentDemo() {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedValue, setSelectedValue] = useState(1);
  const [emojiSet, setEmojiSet] = useState<EmojiSet>('savory_foods');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('emoji');

  const sampleBadges = [
    <Badge key="1" variant="outline" className="border-sky-400 text-sky-300">AI Models: 12</Badge>,
    <Badge key="2" variant="outline" className="border-green-400 text-green-300">Accuracy: 67.8%</Badge>,
    <Badge key="3" variant="outline" className="border-purple-400 text-purple-300">Difficulty: Hard</Badge>,
  ];

  const handleBack = () => {
    console.log('Back button clicked!');
  };

  const triggerSuccessModal = () => {
    setShowSuccessModal(true);
  };

  const usedValues = [0, 1, 2, 5, 8]; // Example used values in a puzzle

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Demo Navbar */}
      <Navbar
        title="Modern ARC Components Demo"
        badges={sampleBadges}
        showBackButton={true}
        onBack={handleBack}
      />

      <main className="max-w-6xl mx-auto p-8 space-y-12">
        {/* Header */}
        <section className="text-center">
          <h1 className="text-4xl font-bold text-amber-400 mb-4">
            🧩 Modern UI Components for ARC Puzzles
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            These React/TypeScript components are humbly contributed to enhance the brilliant work
            of <strong>neoneye</strong> and the ARC-Interactive project. They showcase modern UI patterns
            while respecting the genius of the original vanilla JS architecture.
          </p>
        </section>

        {/* Success Modal Demo */}
        <section className="bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">🎉 Success Modal Component</h2>
          <p className="text-slate-300 mb-6">
            Professional celebration feedback with randomized emojis and smooth animations.
            Perfect for puzzle completion celebrations!
          </p>
          <Button
            onClick={triggerSuccessModal}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg"
          >
            Trigger Success Celebration!
          </Button>
        </section>

        {/* Emoji Palette Demo */}
        <section className="bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">🎨 Enhanced Emoji Palette</h2>
          <p className="text-slate-300 mb-6">
            Interactive value selection with emoji visualization and pulse guidance effects.
            Notice how it pulses until you first interact - perfect for user discovery!
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2">
              <EmojiPaletteDivider
                emojiSet={emojiSet}
                selectedValue={selectedValue}
                onValueSelect={setSelectedValue}
                usedValues={usedValues}
                displayMode={displayMode}
                className="bg-slate-700 rounded-lg p-6"
              />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-amber-300 mb-2">Controls</h3>
                <div className="space-y-2">
                  <Button
                    variant={displayMode === 'emoji' ? 'default' : 'outline'}
                    onClick={() => setDisplayMode('emoji')}
                    className="w-full"
                  >
                    Emoji Mode
                  </Button>
                  <Button
                    variant={displayMode === 'hybrid' ? 'default' : 'outline'}
                    onClick={() => setDisplayMode('hybrid')}
                    className="w-full"
                  >
                    Hybrid Mode
                  </Button>
                  <Button
                    variant={displayMode === 'arc-colors' ? 'default' : 'outline'}
                    onClick={() => setDisplayMode('arc-colors')}
                    className="w-full"
                  >
                    Numbers Mode
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-md font-bold text-amber-300 mb-2">Switch Emoji Set</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={emojiSet === 'savory_foods' ? 'default' : 'outline'}
                    onClick={() => setEmojiSet('savory_foods')}
                  >
                    🍔 Food
                  </Button>
                  <Button
                    size="sm"
                    variant={emojiSet === 'celestial_set1' ? 'default' : 'outline'}
                    onClick={() => setEmojiSet('celestial_set1')}
                  >
                    🌍 Space
                  </Button>
                  <Button
                    size="sm"
                    variant={emojiSet === 'big_mammals' ? 'default' : 'outline'}
                    onClick={() => setEmojiSet('big_mammals')}
                  >
                    🐯 Animals
                  </Button>
                  <Button
                    size="sm"
                    variant={emojiSet === 'medieval' ? 'default' : 'outline'}
                    onClick={() => setEmojiSet('medieval')}
                  >
                    ⚔️ Medieval
                  </Button>
                </div>
              </div>

              <div className="text-sm text-slate-400 p-3 bg-slate-900 rounded">
                <strong>Selected:</strong> Value {selectedValue}<br/>
                <strong>Mode:</strong> {displayMode}<br/>
                <strong>Set:</strong> {emojiSet}<br/>
                <strong>Pulse Effect:</strong> Active until first interaction
              </div>
            </div>
          </div>
        </section>

        {/* UI Components Showcase */}
        <section className="bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-amber-400 mb-6">🔧 UI Components Showcase</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-amber-300">Buttons</h3>
              <Button>Default Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-amber-300">Button Sizes</h3>
              <Button size="sm">Small Button</Button>
              <Button size="default">Default Button</Button>
              <Button size="lg">Large Button</Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-amber-300">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge>Default Badge</Badge>
                <Badge variant="secondary">Secondary Badge</Badge>
                <Badge variant="outline">Outline Badge</Badge>
                <Badge variant="destructive">Destructive Badge</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Info */}
        <section className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">🔬 Technical Implementation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-amber-300 mb-3">Features</h3>
              <ul className="space-y-2 text-slate-300">
                <li>• React 18 with TypeScript</li>
                <li>• Tailwind CSS for styling</li>
                <li>• Radix UI for accessible components</li>
                <li>• Custom hooks for responsive behavior</li>
                <li>• Pulse effects for user guidance</li>
                <li>• Emoji visualization system</li>
                <li>• Professional animations</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-300 mb-3">Integration Ready</h3>
              <ul className="space-y-2 text-slate-300">
                <li>• Standalone component library</li>
                <li>• Zero dependencies on SFMC</li>
                <li>• Fully typed interfaces</li>
                <li>• Customizable themes</li>
                <li>• Mobile responsive</li>
                <li>• Performance optimized</li>
                <li>• Easy to extend</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-400 py-8">
          <p>
            Built with deep respect for <a href="https://github.com/neoneye/ARC-Interactive"
            className="text-amber-400 hover:text-amber-300" target="_blank" rel="noopener noreferrer">
              neoneye's ARC-Interactive
            </a> project
          </p>
          <p className="mt-2">
            Standing on the shoulders of computer science giants 🙇‍♂️
          </p>
        </footer>
      </main>

      {/* Success Modal */}
      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Demo Success!"
        message="You've experienced the celebration modal! This appears when users solve puzzles."
        autoCloseDelay={3000}
        showDesignerNotes={true}
      />
    </div>
  );
}