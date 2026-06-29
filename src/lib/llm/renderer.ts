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
      const content = typeof section.content === 'string'
        ? section.content
        : JSON.stringify(section.content, null, 2);
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
