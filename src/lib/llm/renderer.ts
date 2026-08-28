import { PromptPackage } from '../reflection/types';

export class PromptRenderer {
  /**
   * Render PromptPackage into a unified markdown formatted string.
   */
  public static renderToText(pkg: PromptPackage): string {
    const lines: string[] = [];

    // Render sections in priority descending order
    const sortedSections = [...pkg.sections].sort((a, b) => b.priority - a.priority);
    for (const section of sortedSections) {
      const header = `### ${section.id.toUpperCase()}`;
      let content: string;

      if (section.id === 'recent_conversation_history' && Array.isArray(section.content)) {
        content = section.content.map((turn: any) => {
          const speaker = turn.role === 'user'
            ? 'User'
            : (turn.mascotId ? (turn.mascotId.charAt(0).toUpperCase() + turn.mascotId.slice(1)) : 'Assistant');
          const cleanText = typeof turn.content === 'string' ? turn.content.trim() : JSON.stringify(turn.content);
          return `${speaker}: "${cleanText}"`;
        }).join('\n');
      } else if (section.id === 'current_user_message') {
        const cleanText = typeof section.content === 'string' ? section.content.trim() : JSON.stringify(section.content);
        content = `"${cleanText}"`;
      } else if ((section.id === 'cognitive_reflections' || section.id === 'reflection_context') && typeof section.content === 'object' && section.content !== null) {
        const rawReflections = (section.content as any).reflections;
        if (Array.isArray(rawReflections) && rawReflections.length > 0) {
          const reflectionItems = rawReflections.map((r: any) => {
            const blockLines: string[] = [];
            if (typeof r === 'string') {
              blockLines.push(`Insight:\n${r}`);
            } else if (typeof r === 'object' && r !== null) {
              if (r.insight) {
                blockLines.push(`Insight:\n${r.insight}`);
              } else if (r.reflection) {
                blockLines.push(`Insight:\n${r.reflection}`);
              }
              if (r.guidance) {
                blockLines.push(`Guidance:\n${r.guidance}`);
              }
              if (r.perspective) {
                blockLines.push(`Perspective:\n${r.perspective}`);
              }
            }
            return blockLines.join('\n\n');
          });
          content = `(Internal cognitive insights — Do not copy their wording verbatim. Express their meaning naturally.)\n\n${reflectionItems.join('\n\n')}`;
        } else {
          content = JSON.stringify(section.content, null, 2);
        }
      } else {
        content = typeof section.content === 'string'
          ? section.content
          : JSON.stringify(section.content, null, 2);
      }

      lines.push(`${header}\n${content}`);
    }

    // Render structured directives
    if (pkg.directives) {
      const { mustDo, shouldDo, avoid } = pkg.directives;
      const hasDirectives = (mustDo && mustDo.length > 0) || 
                            (shouldDo && shouldDo.length > 0) || 
                            (avoid && avoid.length > 0);

      if (hasDirectives) {
        lines.push('### DIRECTIVES');
        if (mustDo && mustDo.length > 0) {
          lines.push('MUST DO:');
          mustDo.forEach(d => lines.push(`- ${d}`));
        }
        if (shouldDo && shouldDo.length > 0) {
          lines.push('SHOULD DO:');
          shouldDo.forEach(d => lines.push(`- ${d}`));
        }
        if (avoid && avoid.length > 0) {
          lines.push('AVOID:');
          avoid.forEach(d => lines.push(`- ${d}`));
        }
      }
    }

    return lines.join('\n\n');
  }

  /**
   * Render PromptPackage into a structured object for JSON adapters.
   */
  public static renderToStructured(pkg: PromptPackage): Record<string, unknown> {
    return {
      version: pkg.version,
      templateVersion: pkg.templateVersion,
      directives: pkg.directives,
      renderStrategy: pkg.renderStrategy,
      sections: pkg.sections.map(s => ({
        id: s.id,
        type: s.type,
        content: s.content
      }))
    };
  }
}
