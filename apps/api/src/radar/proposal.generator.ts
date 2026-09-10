// src/radar/proposal.generator.ts
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { FreelancerProjectExtended } from '@fstail/types';
import type { ProposalFramework } from '@prisma/client';

export interface GeneratedProposal {
  proposalText: string;
  suggestedPrice: number | null;
  minimumPrice: number | null;
  recommendedPrice: number | null;
  deliveryDays: number | null;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  clientSummary: string;
  checklist: string[];
  analysis: {
    responseProbability: number | null;
    complexity: number | null;
    whatClientIsBuying: string;
    risks: string[];
    criticalErrors: string[];
    missingInformation: string[];
    comparison: string;
  };
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

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const GROQ_MODEL_FALLBACKS = [
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];

@Injectable()
export class ProposalGenerator {
  private readonly logger = new Logger(ProposalGenerator.name);
  private groq: Groq;
  private model: string;

  constructor(private readonly config: ConfigService) {
    this.groq = new Groq({
      apiKey: config.getOrThrow<string>('GROQ_API_KEY'),
    });
    const configuredModel = config.get<string>('GROQ_MODEL', DEFAULT_GROQ_MODEL);
    this.model = configuredModel;
  }

  async generate(
    project: FreelancerProjectExtended,
    framework: ProposalFramework = 'AIDA',
    context?: string,
  ): Promise<GeneratedProposal> {
    const frameworkInstructions =
      FRAMEWORK_PROMPTS[framework] ?? FRAMEWORK_PROMPTS['AIDA']!;

    const systemPrompt = `You are a Freelancer.com proposal strategist and acquisition analyst.
  Your objective is to start a conversation, not to write a generic bid.
  Never invent experience, clients, certifications, portfolio work, results, or technical facts.
  Use this portfolio only when it is genuinely relevant to the requested work: https://alqmst99.github.io/profesional-plan/pages/projects.html
  If you mention the portfolio, include the exact URL and connect it to a relevant capability. Never include it just to fill space.
  Always respond with valid JSON only. No markdown, no preamble.`;

    const currencySign = project.currency?.sign ?? '$';
    const avgBid = project.avgBid ?? 0;
    const recommendedPrice = avgBid > 0
      ? Math.round(avgBid * 0.92)
      : Math.round((project.budget?.minimum ?? 0) * 0.9);
    const userPrompt = `Analyze this Freelancer.com project and generate a response-oriented proposal.

PROJECT TITLE: ${project.title}
CLIENT REQUEST / ORIGINAL PROJECT DESCRIPTION: ${project.description}
BUDGET: ${currencySign}${project.budget.minimum}–${project.budget.maximum}
MARKET AVERAGE BID: ${avgBid ? `${currencySign}${avgBid}` : 'unknown'}
RECOMMENDED BID: ${recommendedPrice ? `${currencySign}${recommendedPrice}` : 'unknown'}
SKILLS REQUIRED: ${project.skills.join(', ')}
CURRENT BID COUNT: ${project.bidCount}
CLIENT PAYMENT VERIFIED: ${project.paymentVerified === true ? 'yes' : project.paymentVerified === false ? 'no' : 'unknown'}
CLIENT COUNTRY: ${project.clientCountry ?? 'unknown'}
CLIENT REPUTATION: ${project.clientReputation ?? 'unknown'}
CLIENT PROJECTS POSTED / COMPLETED: ${project.clientProjectsPosted ?? 'unknown'} / ${project.clientProjectsCompleted ?? 'unknown'}
${context ? `\nAGENCY CONTEXT: ${context}` : ''}

PROFILE CONTEXT: web developer working with systems, automation, SaaS, React, Node.js, PHP, WordPress, APIs, databases, technical SEO, UI/UX and infrastructure. Mention these only when directly relevant.

STRATEGY RULES:
- Proposal must be 70-120 words, preferably 80-120, in English unless the project is clearly in another language.
- Never introduce the freelancer first. Start with the client's problem.
- Demonstrate understanding before offering a solution.
- Mention one concrete risk, challenge, or requirement.
- Ask one useful question when appropriate and end with a clear next step.
- Focus on outcomes, not technology lists, years of experience, free consulting, architecture, or roadmaps.
- Reference the portfolio only when it strengthens proof for this project, and connect it to the requirement.
- Avoid corporate language and generic phrases such as "I am an expert developer", "I can do this project", "Please contact me", "I am excited", "I am passionate", "Best quality", and "Perfect fit".

ANALYSIS RULES:
- Identify the real problem, what the client is buying, complexity, effort, risks, missing information, price floor, recommended price, and days.
- Analyze the client's original request above. Do not assume that the client supplied a winning proposal.
- Estimate response probability from project clarity, client signals, competition, price and proposal quality. Be conservative.

${frameworkInstructions}

Respond ONLY with this JSON object (no markdown, no extra text):
{
  "proposalText": "The final proposal, 70-120 words",
  "clientSummary": "One sentence summary of what this client needs",
  "minimumPrice": <integer in USD, null if unclear>,
  "recommendedPrice": <integer in USD, null if unclear>,
  "suggestedPrice": <same as recommendedPrice, integer in USD or null>,
  "deliveryDays": <integer, null if unclear>,
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "checklist": ["short deliverable or validation point"],
  "analysis": {
    "responseProbability": <integer 0-10 or null>,
    "complexity": <integer 0-10 or null>,
    "whatClientIsBuying": "design, development, business, marketing, SEO, automation, maintenance, trust, or problem solving",
    "risks": ["specific risk"],
    "criticalErrors": ["proposal or project error to avoid"],
    "missingInformation": ["question or missing requirement"],
    "comparison": "Explain briefly why this proposal is stronger than a generic bid"
  }
}`;

    try {
      let completion;
      try {
        completion = await this.createCompletion(systemPrompt, userPrompt, this.model);
      } catch (firstError: any) {
        const firstStatus = firstError?.status ?? firstError?.statusCode;
        if (firstStatus !== 404) throw firstError;

        const fallbackModel = GROQ_MODEL_FALLBACKS.find((model) => model !== this.model);
        if (!fallbackModel) throw firstError;
        this.logger.warn(`Groq model ${this.model} unavailable; retrying with ${fallbackModel}`);
        this.model = fallbackModel;
        completion = await this.createCompletion(systemPrompt, userPrompt, this.model);
      }

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const parsed = this.parseResponse(raw);
      parsed.suggestedPrice = (parsed.suggestedPrice ?? parsed.recommendedPrice ?? recommendedPrice) || null;

      this.logger.log(
        `Proposal generated for "${project.title}" (${framework}, ${this.model})`,
      );

      return { ...parsed, modelUsed: this.model };
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const message = String(err?.error?.error?.message ?? err?.message ?? 'unknown error');
      this.logger.error(`Groq API error (${status ?? 'unknown'}): ${message}`);
      if (status === 401) {
        throw new ServiceUnavailableException(
          'Groq rechazó la API key (401). Actualizá GROQ_API_KEY en el entorno de la API y reiniciala.',
        );
      }
      if (status === 429) {
        throw new ServiceUnavailableException(
          'Groq alcanzó el límite de uso (429). Esperá unos segundos o revisá el límite de tu cuenta.',
        );
      }
      if (status === 404) {
        throw new ServiceUnavailableException(
          `El modelo de Groq no está disponible (${this.model}). Configurá GROQ_MODEL=${DEFAULT_GROQ_MODEL} y reiniciá la API.`,
        );
      }
      throw new ServiceUnavailableException(
        `Groq no pudo generar la propuesta (${status ?? 'error'}). Revisá el log de la API.`,
      );
    }
  }

  private createCompletion(systemPrompt: string, userPrompt: string, model: string) {
    return this.groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1536,
      response_format: { type: 'json_object' },
    });
  }

  private parseResponse(raw: string): Omit<GeneratedProposal, 'modelUsed'> {
    try {
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return {
        proposalText:   String(json['proposalText']  ?? ''),
        clientSummary:  String(json['clientSummary'] ?? ''),
        minimumPrice: this.toNullableNumber(json['minimumPrice']),
        recommendedPrice: this.toNullableNumber(json['recommendedPrice']),
        suggestedPrice: this.toNullableNumber(json['suggestedPrice']),
        deliveryDays:   Number.isFinite(json['deliveryDays'])   ? Number(json['deliveryDays'])   : null,
        difficulty:     ['EASY', 'MEDIUM', 'HARD'].includes(json['difficulty'])
          ? json['difficulty']
          : 'MEDIUM',
        checklist: Array.isArray(json['checklist'])
          ? json['checklist'].map(String).slice(0, 10)
          : [],
        analysis: {
          responseProbability: this.toBoundedNumber(json['analysis']?.['responseProbability'], 0, 10),
          complexity: this.toBoundedNumber(json['analysis']?.['complexity'], 0, 10),
          whatClientIsBuying: String(json['analysis']?.['whatClientIsBuying'] ?? ''),
          risks: this.toStringArray(json['analysis']?.['risks']),
          criticalErrors: this.toStringArray(json['analysis']?.['criticalErrors']),
          missingInformation: this.toStringArray(json['analysis']?.['missingInformation']),
          comparison: String(json['analysis']?.['comparison'] ?? ''),
        },
      };
    } catch {
      this.logger.error(`Failed to parse Groq response: ${raw.slice(0, 200)}`);
      return {
        proposalText:  raw,
        clientSummary: '',
        minimumPrice: null,
        recommendedPrice: null,
        suggestedPrice: null,
        deliveryDays:   null,
        difficulty:    'MEDIUM',
        checklist:     [],
        analysis: {
          responseProbability: null,
          complexity: null,
          whatClientIsBuying: '',
          risks: [],
          criticalErrors: [],
          missingInformation: [],
          comparison: '',
        },
      };
    }
  }

  private toNullableNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  }

  private toBoundedNumber(value: unknown, min: number, max: number): number | null {
    const number = this.toNullableNumber(value);
    return number === null ? null : Math.min(max, Math.max(min, number));
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 8) : [];
  }
}
