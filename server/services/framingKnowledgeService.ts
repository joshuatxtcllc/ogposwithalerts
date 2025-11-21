
export class FramingKnowledgeService {
  private knowledgeBase = {
    materials: {
      mats: {
        types: ['Acid-free', 'Conservation', 'Rag mat', 'Photo mat', 'Black core'],
        selection: 'Use acid-free, lignin-free mats for all valuable artwork. Standard width 2.5-3.5 inches.',
        troubleshooting: {
          waviness: 'Check humidity levels, use proper storage, ensure quality matboard',
          discoloration: 'Use conservation-grade, buffered mats for paper artwork',
          bleeding: 'Ensure colorfast mats, test before use'
        }
      },
      glass: {
        types: ['Clear glass', 'Non-glare glass', 'UV glass', 'Museum glass', 'Acrylic'],
        recommendations: {
          'valuable art': 'UV-filtering glass (97%+ protection)',
          'photography': 'UV glass, avoid non-glare',
          'high traffic': 'Acrylic for safety',
          'textured art': 'Clear glass with spacers'
        }
      },
      moulding: {
        sizing: {
          'small (8x10-11x14)': '3/4" to 1.5" wide',
          'medium (16x20-24x30)': '1.5" to 2.5" wide', 
          'large (30x40+)': '2.5" to 4"+ wide'
        },
        styles: {
          traditional: 'Ornate profiles, gold/silver leaf finishes',
          modern: 'Clean lines, minimal profiles, metal options',
          photography: 'Thin profiles, neutral colors'
        }
      }
    },
    techniques: {
      mounting: {
        hinge: 'Preferred method - attach only at top edge with Japanese tissue',
        window: 'For thick items - cut opening in backing, support from behind',
        float: 'Shows full artwork edges - use hidden supports',
        conservation: 'Use only reversible materials and techniques'
      },
      spacing: {
        required: ['Pastels', 'Charcoal', 'Thick paint', 'Canvas', '3D elements'],
        types: ['Clear acrylic strips', 'Matboard strips', 'Built-in rabbet'],
        calculation: 'Art thickness + 1/8" minimum clearance'
      }
    },
    troubleshooting: {
      'warped frame': 'Check moisture content, use corner braces, re-join if needed',
      'mat waviness': 'Control humidity, use quality materials, proper storage',
      'condensation': 'Add spacers for ventilation, check humidity levels',
      'color changes': 'Use UV protection, archival materials, proper lighting',
      'pest issues': 'Reduce humidity, use cedar, check entry points'
    }
  };

  async searchFramingKnowledge(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    // Material queries
    if (lowerQuery.includes('mat')) {
      if (lowerQuery.includes('wavy') || lowerQuery.includes('wave')) {
        return this.knowledgeBase.materials.mats.troubleshooting.waviness;
      }
      if (lowerQuery.includes('discolor') || lowerQuery.includes('burn')) {
        return this.knowledgeBase.materials.mats.troubleshooting.discoloration;
      }
      return `Mat Selection Guide: ${this.knowledgeBase.materials.mats.selection}\n\nTypes available: ${this.knowledgeBase.materials.mats.types.join(', ')}`;
    }

    if (lowerQuery.includes('glass') || lowerQuery.includes('glazing')) {
      return `Glass Types: ${this.knowledgeBase.materials.glass.types.join(', ')}\n\nRecommendations:\n${Object.entries(this.knowledgeBase.materials.glass.recommendations).map(([use, rec]) => `• ${use}: ${rec}`).join('\n')}`;
    }

    if (lowerQuery.includes('moulding') || lowerQuery.includes('frame size')) {
      return `Moulding Sizing:\n${Object.entries(this.knowledgeBase.materials.moulding.sizing).map(([size, width]) => `• ${size}: ${width}`).join('\n')}\n\nStyles:\n${Object.entries(this.knowledgeBase.materials.moulding.styles).map(([style, desc]) => `• ${style}: ${desc}`).join('\n')}`;
    }

    // Technique queries
    if (lowerQuery.includes('mount') || lowerQuery.includes('mounting')) {
      return `Mounting Techniques:\n${Object.entries(this.knowledgeBase.techniques.mounting).map(([method, desc]) => `• ${method}: ${desc}`).join('\n')}`;
    }

    if (lowerQuery.includes('spacing') || lowerQuery.includes('spacer')) {
      return `Spacing Requirements:\nRequired for: ${this.knowledgeBase.techniques.spacing.required.join(', ')}\nTypes: ${this.knowledgeBase.techniques.spacing.types.join(', ')}\nCalculation: ${this.knowledgeBase.techniques.spacing.calculation}`;
    }

    // Conservation queries
    if (lowerQuery.includes('conservation') || lowerQuery.includes('archival')) {
      return `Conservation Framing Standards:
• Use only acid-free, lignin-free materials
• UV-filtering glazing (97%+ protection) 
• Reversible mounting techniques only
• Proper spacers between art and glazing
• Document all materials used
• Maintain 45-55% humidity`;
    }

    // Canvas/painting queries
    if (lowerQuery.includes('canvas') || lowerQuery.includes('oil') || lowerQuery.includes('acrylic')) {
      return `Canvas & Paint Framing:
• Oil paintings must be completely dry (6+ months for thick applications)
• Always use spacers - never touch glass directly
• Allow air circulation in frame
• Consider UV glazing for protection
• Check canvas tension before framing
• Float mounting shows canvas edges, traditional covers them`;
    }

    return "I can help with framing techniques, materials, conservation methods, and troubleshooting. Try asking about specific topics like 'mat selection', 'glass types', or 'mounting techniques'.";
  }

  async getTroubleshootingHelp(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    for (const [problem, solution] of Object.entries(this.knowledgeBase.troubleshooting)) {
      if (lowerQuery.includes(problem)) {
        return `${problem.toUpperCase()} Solution: ${solution}`;
      }
    }

    return `Common Issues I can help with:
• Warped frames
• Mat waviness  
• Glass condensation
• Color changes in artwork
• Pest problems

Describe your specific issue for targeted advice.`;
  }

  async getMaterialAdvice(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('watercolor') || lowerQuery.includes('paper')) {
      return `Watercolor/Paper Artwork:
• Use acid-free, buffered mats
• UV-filtering glass essential
• Hinge mounting only (top edge)
• Allow for natural expansion
• Standard mat width: 2.5-3 inches`;
    }

    if (lowerQuery.includes('photo') || lowerQuery.includes('print')) {
      return `Photography Framing:
• UV glass crucial for longevity
• Avoid non-glare glass (affects image quality)
• Use photo-specific mats (unbuffered)
• Consider float mounting for impact
• Thin profile frames work well`;
    }

    if (lowerQuery.includes('oil') || lowerQuery.includes('thick paint')) {
      return `Oil Painting Materials:
• Must use spacers (1/8" minimum)
• Never let paint touch glass
• UV glazing recommended
• Allow air circulation
• Frame depth must accommodate thickness`;
    }

    if (lowerQuery.includes('valuable') || lowerQuery.includes('expensive')) {
      return `Valuable Artwork Materials:
• Museum-quality UV glass (99% protection)
• 100% rag mats, acid-free
• Conservation mounting only
• Archival backing boards
• Document all materials used
• Professional installation recommended`;
    }

    return "Material recommendations depend on artwork type. Ask about specific mediums like 'watercolor', 'photography', 'oil painting', or 'valuable artwork'.";
  }
}

export const framingKnowledgeService = new FramingKnowledgeService();
