import { MascotCharacter, MascotExpression } from '@/components/Mascot'

export type EnvelopeLetterType = 'signup' | 'daily_return' | 'inactivity' | 'milestone'

export interface EnvelopeLetter {
  id: string
  user_id: string
  letter_type: EnvelopeLetterType
  milestone_key: string | null
  content: string
  mascot_character_used: MascotCharacter
  mascot_expression: MascotExpression
  scene_used: string
  presentation_type: 'envelope' | 'direct'
  relationship_level_snapshot: string
  nickname_snapshot: string
  is_read: boolean
  created_at: string
}

export interface WelcomeState {
  greeting: string
  presentation_type: 'envelope' | 'direct'
  letter: EnvelopeLetter | null
  mascot_character: MascotCharacter
  mascot_expression: MascotExpression
  mascot_message: string
  visual_scene: string
  notices: string[]
}
