// src/radar/proposal.generator.ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { FreelancerProject } from '@fstail/types';
import type { ProposalFramework } from '@prisma/client';

export interface GeneratedProposal {
  proposalText: string;
  suggestedPrice: number | null;
  deliveryDays: number | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  clientSummary: string;
  checklist: string[];
  modelUsed: string;
}

const FRAMEWORK_PROMPTS: Record<string, string> = {
  AIDA: `Use the AIDA framework:
- Attention: Hook the client with their specific pain point
- Interest: Show you understand their project deeply
- Desire: Demonstrate the value and outcome you'll deliver
- Action: Clear call to action with a specific next step`,

  PAS: `Use the PAS framework:
- Problem: Name their specific problem clearly
- Agitate: Show the cost of not solving it
- Solution: Present your solution and why it works`,

  BAB: `Use the BAB framework:
- Before: Describe their current situation and pain
- After: Paint the picture of success after your work
- Bridge: Explain how you get them there`,
};

@Injectable()
export class ProposalGenerator {
  private readonly logger = new Logger(ProposalGenerator.name);
  private groq: Groq;
  private model: string;

  constructor(private readonly config: ConfigService) {
    this.groq = new Groq({
      apiKey: config.getOrThrow<string>('GROQ_API_KEY'),
    });
    this.model = config.get<string>('GROQ_MODEL', 'llama-3.3-70b-versatile');
  }

  async generate(
    project: FreelancerProject,
    framework: ProposalFramework = 'AIDA',
    context?: string,
  ): Promise<GeneratedProposal> {
    const frameworkInstructions =
      FRAMEWORK_PROMPTS[framework] ?? FRAMEWORK_PROMPTS['AIDA']!;

    const systemPrompt = `You are an expert freelance proposal writer for FSTail Solutions, a professional web development agency.
Your proposals are concise, client-focused, and conversion-optimised.
Always respond in JSON format only — no markdown, no preamble.`;

    const currencySign = project.currency?.sign ?? '$';
    const userPrompt = `Generate a Freelancer.com proposal for this project.

PROJECT TITLE: ${project.title}
DESCRIPTION: ${project.description}
BUDGET: ${currencySign}${project.budget.minimum}–${project.budget.maximum}
SKILLS REQUIRED: ${project.skills.join(', ')}
CURRENT BID COUNT: ${project.bidCount}
${context ? `\nAGENCY CONTEXT: ${context}` : ''}

${frameworkInstructions}

Respond ONLY with this JSON object (no markdown, no extra text):
{
  "proposalText": "The full proposal text (200-350 words)",
  "clientSummary": "One sentence summary of what this client needs",
  "suggestedPrice": <integer in USD, null if unclear>,
  "deliveryDays": <integer, null if unclear>,
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "checklist": ["deliverable 1", "deliverable 2", "deliverable 3"]
}`;

    try {
      const completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = this.parseResponse(raw);

      this.logger.log(
        `Proposal generated for "${project.title}" (${framework}, ${this.model})`,
      );

      return { ...parsed, modelUsed: this.model };
    } catch (err) {
      this.logger.error('Groq API error', err);
      throw new ServiceUnavailableException(
        'AI proposal generation is temporarily unavailable. Please try again.',
      );
    }
  }

  private parseResponse(raw: string): Omit<GeneratedProposal, 'modelUsed'> {
    try {
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return {
        proposalText:   String(json['proposalText']  ?? ''),
        clientSummary:  String(json['clientSummary'] ?? ''),
        suggestedPrice: Number.isFinite(json['suggestedPrice']) ? Number(json['suggestedPrice']) : null,
        deliveryDays:   Number.isFinite(json['deliveryDays'])   ? Number(json['deliveryDays'])   : null,
        difficulty:     ['EASY', 'MEDIUM', 'HARD'].includes(json['difficulty'])
          ? json['difficulty']
          : 'MEDIUM',
        checklist: Array.isArray(json['checklist'])
          ? json['checklist'].map(String).slice(0, 10)
          : [],
      };
    } catch {
      this.logger.error(`Failed to parse Groq response: ${raw.slice(0, 200)}`);
      return {
        proposalText:  raw,
        clientSummary: '',
        suggestedPrice: null,
        deliveryDays:   null,
        difficulty:    'MEDIUM',
        checklist:     [],
      };
    }
  }
}
