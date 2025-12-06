'use client';

import { FormEvent, useState } from 'react';
import { useToast } from './Toast';

interface GalleryCommandBarProps {
  hiddenFolders: string[];
  knownFolders: string[];
  onHideFolder: (folderName: string) => boolean;
  onUnhideFolder: (folderName: string) => boolean;
  onClearHidden: () => boolean;
  showParentsOnly: boolean;
  onSetParentsOnly: (value: boolean) => void;
}

const baseHelp = [
  'Available commands:',
  '- hide folder <name>: Temporarily remove a folder from the gallery',
  '- show folder <name>: Bring a hidden folder back into the gallery',
  '- list hidden: Show currently hidden folders',
  '- clear hidden: Unhide every folder',
  '- list folders: List all known folders',
  '- parents only: Only show images that have variants',
  '- show all: Show every image, including solos',
  '- help: Show this command list'
].join(' ');

export default function GalleryCommandBar({
  hiddenFolders,
  knownFolders,
  onHideFolder,
  onUnhideFolder,
  onClearHidden,
  showParentsOnly,
  onSetParentsOnly
}: GalleryCommandBarProps) {
  const [inputValue, setInputValue] = useState('');
  const [statusLine, setStatusLine] = useState(baseHelp);
  const toast = useToast();

  const runCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) {
      setStatusLine('Enter a command or type "help".');
      return;
    }

    if (/^help$/i.test(trimmed)) {
      setStatusLine(baseHelp);
      return;
    }

    if (/^(list|show)\s+hidden$/i.test(trimmed)) {
      setStatusLine(hiddenFolders.length ? `Hidden: ${hiddenFolders.join(', ')}` : 'No hidden folders.');
      return;
    }

    if (/^(list|show)\s+folders$/i.test(trimmed)) {
      setStatusLine(knownFolders.length ? `Folders: ${knownFolders.join(', ')}` : 'No folders yet.');
      return;
    }

    if (/^(clear|reset)\s+hidden$/i.test(trimmed)) {
      const cleared = onClearHidden();
      setStatusLine(cleared ? 'Hidden list cleared.' : 'Nothing to clear.');
      if (cleared) {
        toast.push('All hidden folders cleared');
      }
      return;
    }

    if (/^(parents\s+only|only\s+parents|hide\s+solo(?:\s+images)?|hide\s+solos)$/i.test(trimmed)) {
      if (!showParentsOnly) {
        onSetParentsOnly(true);
        toast.push('Parents-only filter enabled');
      }
      setStatusLine('Showing only images with variants.');
      return;
    }

    if (/^(show\s+all|show\s+solos|allow\s+solo(?:\s+images)?|include\s+solo(?:\s+images)?)$/i.test(trimmed)) {
      if (showParentsOnly) {
        onSetParentsOnly(false);
        toast.push('Solo images restored');
      }
      setStatusLine('Showing all images.');
      return;
    }

    const hideMatch = /^(hide)\s+(?:folder\s+)?(.+)$/i.exec(trimmed);
    if (hideMatch) {
      const folderName = hideMatch[2].trim();
      if (!folderName) {
        setStatusLine('Provide a folder name to hide.');
        return;
      }
      const added = onHideFolder(folderName);
      setStatusLine(added ? `Hiding folder "${folderName}".` : `"${folderName}" is already hidden.`);
      if (added) {
        toast.push(`"${folderName}" hidden from gallery`);
      }
      return;
    }

    const showMatch = /^(unhide|show)\s+(?:folder\s+)?(.+)$/i.exec(trimmed);
    if (showMatch) {
      const folderName = showMatch[2].trim();
      if (!folderName) {
        setStatusLine('Provide a folder name to show.');
        return;
      }
      const removed = onUnhideFolder(folderName);
      setStatusLine(removed ? `Showing folder "${folderName}".` : `"${folderName}" was not hidden.`);
      if (removed) {
        toast.push(`"${folderName}" is now visible`);
      }
      return;
    }

    setStatusLine(`Unknown command "${trimmed}". Type "help".`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runCommand(inputValue);
    setInputValue('');
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-3">
      <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-wide text-slate-400">
        <span className="text-green-300">Gallery CLI</span>
        <span className="text-slate-500 lowercase">hide folder maintenance</span>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
        <span className="text-green-300 text-sm">$</span>
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder='Try "hide folder ops"'
          className="flex-1 bg-transparent border-b border-slate-700 text-[0.75rem] font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-slate-400"
        />
        <button
          type="submit"
          className="text-[0.6rem] uppercase tracking-wide px-2 py-1 border border-slate-700 rounded text-slate-200 hover:border-slate-400"
        >
          Run
        </button>
      </form>
      <p className="mt-2 text-[0.6rem] text-slate-300 break-words min-h-[1.5rem]">{statusLine}</p>
    </div>
  );
}
