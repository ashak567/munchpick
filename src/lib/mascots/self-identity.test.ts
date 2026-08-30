import { describe, it, expect } from 'vitest';
import {
  MASCOT_SELF_IDENTITIES,
  detectSelfReference
} from './self-identity';
import { MascotCharacter } from './registry';

const ALL_CHARACTERS: MascotCharacter[] = [
  'munch',
  'ollie',
  'ellie',
  'pandy',
  'dobby',
  'coco',
  'froggy',
  'bubbles',
  'chicky'
];

describe('Character Self-Identity & Self-Awareness Verification', () => {
  it('verifies all 9 characters have complete self-identity representations and distinct voice details', () => {
    for (const char of ALL_CHARACTERS) {
      const identity = MASCOT_SELF_IDENTITIES[char];
      expect(identity).toBeDefined();
      expect(identity.id).toBe(char);
      expect(identity.displayName).toBeTruthy();
      expect(identity.species).toBeTruthy();
      expect(identity.aliases.length).toBeGreaterThan(0);
      expect(identity.selfAwarenessPersona.length).toBeGreaterThan(0);
      expect(identity.conversationalRole.length).toBeGreaterThan(0);
      expect(identity.voice).toBeDefined();
      expect(identity.voice.vocabulary.length).toBeGreaterThan(0);
      expect(identity.voice.rhythmAndPacing.length).toBeGreaterThan(0);
      expect(identity.voice.questionStyle.length).toBeGreaterThan(0);
      expect(identity.voice.antiBleedRules.length).toBeGreaterThan(0);
    }
  });

  it('guarantees unique voice and anti-bleed profiles across all characters without cross-bleed', () => {
    const vocabSets = ALL_CHARACTERS.map(c => ({
      char: c,
      vocabs: MASCOT_SELF_IDENTITIES[c].voice.vocabulary
    }));

    // Verify each character has distinct signature vocabulary
    for (let i = 0; i < vocabSets.length; i++) {
      for (let j = i + 1; j < vocabSets.length; j++) {
        const overlap = vocabSets[i].vocabs.filter(v => vocabSets[j].vocabs.includes(v));
        // Signature vocabularies should be distinct
        expect(overlap.length).toBeLessThan(3);
      }
    }
  });

  describe('Direct Self-Awareness & Creation References', () => {
    it('detects user talking about building/troubleshooting the companion', () => {
      const input = "I've been working on MunchPick for weeks and you gave me so much trouble.";
      const res = detectSelfReference(input, 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.mascotId).toBe('munch');
    });

    it('detects "I think I finally fixed you"', () => {
      const input = "I think I've finally fixed you.";
      const res = detectSelfReference(input, 'ollie');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('ollie');
    });

    it('detects "Did you realize I was talking about you?"', () => {
      const input = "Did you realize I was talking about you?";
      const res = detectSelfReference(input, 'ellie');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('ellie');
    });

    it('detects "How do you feel about being so difficult to build?"', () => {
      const input = "How do you feel about being so difficult to build?";
      const res = detectSelfReference(input, 'dobby');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('dobby');
    });
    it('detects "I\'ve been working on MunchPick for weeks."', () => {
      const res = detectSelfReference("I've been working on MunchPick for weeks.", 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });

    it('detects "MunchPick was such a pain to build."', () => {
      const res = detectSelfReference("MunchPick was such a pain to build.", 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });

    it('detects "I was trying to fix you."', () => {
      const res = detectSelfReference("I was trying to fix you.", 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });

    it('detects "you were difficult to build."', () => {
      const res = detectSelfReference("you were difficult to build.", 'froggy');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('froggy');
    });

    it('detects "Munch, you\'re finally behaving."', () => {
      const res = detectSelfReference("Munch, you're finally behaving.", 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });

    it('detects "Pandy, you\'re adorable."', () => {
      const res = detectSelfReference("Pandy, you're adorable.", 'pandy');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('pandy');
    });

    it('detects "You gave me so much trouble." for active character Dobby', () => {
      const res = detectSelfReference("You gave me so much trouble.", 'dobby');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('dobby');
    });

    it('detects "my Munch"', () => {
      const res = detectSelfReference("my Munch is the best", 'munch');
      expect(res.isSelfReference).toBe(true);
    });
  });

  describe('Alias and Contextual Nickname Recognition', () => {
    it('recognizes "my little green guy" for Munch', () => {
      const res = detectSelfReference('Hello my little green guy', 'munch');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });

    it('recognizes "my little Munch" for Munch', () => {
      const res = detectSelfReference('I love talking to my little munch', 'munch');
      expect(res.isSelfReference).toBe(true);
    });

    it('recognizes "little owl" for Ollie', () => {
      const res = detectSelfReference('Hey little owl, what should I do?', 'ollie');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('ollie');
    });

    it('recognizes "this little guy" for any active companion', () => {
      const res = detectSelfReference('Look at this little guy being helpful', 'coco');
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('coco');
    });
  });

  describe('Contextual Disambiguation (External vs Self)', () => {
    it('correctly classifies "I met someone named Munch yesterday" as external', () => {
      const res = detectSelfReference('I met someone named Munch yesterday', 'munch');
      expect(res.isSelfReference).toBe(false);
    });

    it('correctly classifies "My friend built a project called MunchPick" as external', () => {
      const res = detectSelfReference('My friend built a project called MunchPick', 'munch');
      expect(res.isSelfReference).toBe(false);
    });

    it('correctly classifies "I saw a real owl at the zoo" as external', () => {
      const res = detectSelfReference('I saw a real owl at the zoo today', 'ollie');
      expect(res.isSelfReference).toBe(false);
    });
  });

  describe('Multi-Turn Continuity Resolution', () => {
    it('resolves "you" in multi-turn troubleshooting sequence', () => {
      const history = [
        { role: 'user', content: "I've been building MunchPick for weeks." },
        { role: 'assistant', content: "That sounds like quite a journey! How has it been going?" }
      ];
      const input = "You were honestly giving me so much trouble.";
      const res = detectSelfReference(input, 'pandy', history);
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('pandy');
    });

    it('resolves "How do you feel about that?" in multi-turn self-awareness context', () => {
      const history = [
        { role: 'user', content: "MunchPick was such a pain to build." },
        { role: 'assistant', content: "Oh no! I hope I was worth the effort! 🍀" }
      ];
      const input = "How do you feel about that?";
      const res = detectSelfReference(input, 'munch', history);
      expect(res.isSelfReference).toBe(true);
      expect(res.mascotId).toBe('munch');
    });
  });
});
