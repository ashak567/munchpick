import { describe, it, expect } from 'vitest';
import {
  ALL_TABLE_CHARACTERS,
  createInitialTableState,
  generateSocialReactions,
  planGroupDiscussionTurns
} from './group-events';

describe('Munch Table Natural Group Conversation & Structured Interruptions', () => {
  it('initializes 9 seated companion characters with idle visual states', () => {
    const state = createInitialTableState('Test Topic');
    expect(state.currentTopic).toBe('Test Topic');
    expect(ALL_TABLE_CHARACTERS).toHaveLength(9);

    for (const char of ALL_TABLE_CHARACTERS) {
      expect(state.characterStates[char]).toBe('idle');
      expect(state.characterReactions[char]).toBeNull();
    }
  });

  it('plans structured participation bounded to maximum 3 turns per user message', () => {
    const turns = planGroupDiscussionTurns('I feel so exhausted and do not know what to do next.');
    expect(turns.length).toBeGreaterThanOrEqual(1);
    expect(turns.length).toBeLessThanOrEqual(3);

    // Lead turn should be Pandy for exhaustion/burnout
    expect(turns[0].characterId).toBe('pandy');
    expect(turns[0].intent).toBe('lead_response');
  });

  it('triggers structured interruption when contrasting archetypes interact', () => {
    // When user discusses exhaustion with action elements, Dobby interrupts Pandy
    const turns = planGroupDiscussionTurns('I am exhausted but I need action right now.');
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns[0].characterId).toBe('pandy');

    const secondaryTurn = turns[1];
    expect(secondaryTurn.characterId).toBe('dobby');
    expect(secondaryTurn.isInterruption).toBe(true);
    expect(secondaryTurn.interruptPriority).toBeGreaterThanOrEqual(0.8);
    expect(secondaryTurn.targetCharacterId).toBe('pandy');
  });

  it('routes direct self-reference addresses to the targeted companion', () => {
    const turns = planGroupDiscussionTurns('Ollie, you are overanalyzing this again.');
    expect(turns[0].characterId).toBe('ollie');
    expect(turns[0].intent).toBe('lead_response');
  });

  it('generates playful and supportive social reactions for silent seated companions', () => {
    const teaseReactions = generateSocialReactions('coco', 'Dobby is giving another motivational speech', 'playful_tease');
    const chickyRx = teaseReactions.find((r) => r.characterId === 'chicky');
    expect(chickyRx?.reaction).toBe('laugh');

    const ollieRx = teaseReactions.find((r) => r.characterId === 'ollie');
    expect(ollieRx?.reaction).toBe('eye_roll');

    // Speaker does not react to themselves
    const cocoRx = teaseReactions.find((r) => r.characterId === 'coco');
    expect(cocoRx).toBeUndefined();
  });
});
