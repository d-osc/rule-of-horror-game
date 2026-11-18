import lines from './episode01-dialogue.json';
import { assetUrl } from './fileAssets';

type DialogueId = keyof typeof lines;
type DialogueLine = {
  speaker: string;
  text: string;
  seconds: number;
  pan?: number;
  eerie?: boolean;
};

export const dialogue: Record<DialogueId, DialogueLine> = lines;
export const dialogueByRule: Partial<Record<number, DialogueId>> = {
  0: 'check-in',
  1: 'bath-full',
  2: 'mirror',
  3: 'hands',
  5: 'hair',
  6: 'eyes',
  8: 'bag',
};

export const dialogueUrl = (id: string) => assetUrl(`audio/episode-01/${id}.mp3`);
