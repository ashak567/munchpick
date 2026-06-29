import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MascotPresenceManager } from './MascotPresenceManager'

describe('MascotPresenceManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should fallback to idle by default', () => {
    const manager = new MascotPresenceManager()
    const resolved = manager.resolveTargetExpression({
      mode: 'companion',
      intensity: 'medium',
      expression: 'idle',
      attentionTarget: 'user',
      interactionState: 'idle'
    })
    expect(resolved).toBe('idle')
  })

  it('should resolve thinking when interactionState is typing', () => {
    const manager = new MascotPresenceManager()
    const resolved = manager.resolveTargetExpression({
      mode: 'companion',
      intensity: 'medium',
      expression: 'thinking',
      attentionTarget: 'thinking',
      interactionState: 'typing'
    })
    expect(resolved).toBe('thinking')
  })

  it('should respect minimum duration lifetimes', () => {
    const manager = new MascotPresenceManager()
    
    // Set to thinking (minimumDuration: 800, interruptible: false)
    let res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'thinking',
      attentionTarget: 'thinking',
      interactionState: 'typing'
    })
    expect(res.expression).toBe('thinking')

    // Attempt to interrupt with listening immediately (timeSpent = 0)
    res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'listening',
      attentionTarget: 'composer',
      interactionState: 'typing'
    })
    // Should remain locked as thinking!
    expect(res.expression).toBe('thinking')

    // Advance time by 900ms
    vi.advanceTimersByTime(900)

    // Now attempt to update
    res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'listening',
      attentionTarget: 'composer',
      interactionState: 'typing'
    })
    // Lock released, should now resolve to listening!
    expect(res.expression).toBe('listening')
  })

  it('should regress back to previous states in history when target is idle', () => {
    const manager = new MascotPresenceManager()

    // 1. Idle -> Listening (minimumDuration: 600, interruptible: true)
    let res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'listening',
      attentionTarget: 'composer',
      interactionState: 'typing'
    })
    expect(res.expression).toBe('listening')

    // Advance 700ms
    vi.advanceTimersByTime(700)

    // 2. Listening -> Thinking (minimumDuration: 800, interruptible: false)
    res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'thinking',
      attentionTarget: 'thinking',
      interactionState: 'typing'
    })
    expect(res.expression).toBe('thinking')

    // Advance 900ms
    vi.advanceTimersByTime(900)

    // 3. Clear all states (target is now idle)
    res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'idle',
      attentionTarget: 'user',
      interactionState: 'idle'
    })
    
    // Should regress back to listening instead of jumping to idle!
    expect(res.expression).toBe('listening')

    // Advance 700ms and update again
    vi.advanceTimersByTime(700)
    res = manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'idle',
      attentionTarget: 'user',
      interactionState: 'idle'
    })
    
    // Regress back to idle
    expect(res.expression).toBe('idle')
  })

  it('should merge duplicate inputs in the expression queue', () => {
    const manager = new MascotPresenceManager()
    
    manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'listening',
      attentionTarget: 'composer',
      interactionState: 'typing'
    })
    // Advance time to allow state switch
    vi.advanceTimersByTime(1000)

    manager.update({
      mode: 'companion',
      intensity: 'medium',
      expression: 'listening',
      attentionTarget: 'composer',
      interactionState: 'typing'
    })

    // Queue length should not grow since it merges duplicates
    const queue = (manager as any).expressionQueue
    expect(queue.length).toBe(0)
  })

  it('should lookup custom transition overrides from matrix', () => {
    const duration = MascotPresenceManager.getTransitionDuration('idle', 'listening')
    expect(duration).toBe(200)

    const defaultDuration = MascotPresenceManager.getTransitionDuration('happy', 'calm')
    expect(defaultDuration).toBe(300)
  })
})
